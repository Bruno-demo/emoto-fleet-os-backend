import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TelemetryPayload } from '../mqtt/mqtt-validation.util';
import {
  TripScoreWeights,
  computeTripScore,
  haversineDistanceKm,
  normalizeTripEventCounts,
  roundToDecimals,
} from '../trips/trip-scoring.util';
import { RuleDeviceContext } from './rules-engine.service';

interface TripRuntimeState {
  activeStartTs?: string;
  candidateStartTs?: string;
  idleSinceTs?: string;
  lastProcessedTs?: string;
  lastTripEndTs?: string;
}

interface TripPoint {
  lat: number;
  lng: number;
}

@Injectable()
export class TripBuilderService {
  private readonly logger = new Logger(TripBuilderService.name);
  private readonly startSpeedKph: number;
  private readonly endSpeedKph: number;
  private readonly startMovementSeconds: number;
  private readonly endIdleSeconds: number;
  private readonly minDistanceForScoringKm: number;
  private readonly penaltyMultiplier: number;
  private readonly scoreWeights: TripScoreWeights;
  private readonly maxTripDurationSeconds: number;
  private readonly minTripDistanceKm: number;
  private readonly minTripDurationSec: number;
  private readonly tripCooldownSec: number;
  private readonly tripStreamKey: string | null;
  private readonly streamMaxLen: number;
  private readonly streamEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {
    this.startSpeedKph = this.configService.get<number>(
      'TRIP_START_SPEED_KPH',
      5,
    );
    this.endSpeedKph = this.configService.get<number>('TRIP_END_SPEED_KPH', 5);
    this.startMovementSeconds = this.configService.get<number>(
      'TRIP_START_MOVEMENT_SECONDS',
      30,
    );
    this.endIdleSeconds = this.configService.get<number>(
      'TRIP_END_IDLE_SECONDS',
      300,
    );
    this.maxTripDurationSeconds = this.configService.get<number>(
      'MAX_TRIP_DURATION_SECONDS',
      43200, // 12 hours
    );
    this.minTripDistanceKm = this.configService.get<number>(
      'MIN_TRIP_DISTANCE_KM',
      0.2, // 200 meters — ignore GPS jitter and ignition bounce
    );
    this.minTripDurationSec = this.configService.get<number>(
      'MIN_TRIP_DURATION_SEC',
      60, // 1 minute — sub-minute trips are always noise
    );
    this.tripCooldownSec = this.configService.get<number>(
      'TRIP_COOLDOWN_SEC',
      60, // Ignore ignition-on within 60s of previous trip end
    );
    this.minDistanceForScoringKm = this.configService.get<number>(
      'TRIP_SCORE_MIN_DISTANCE_KM',
      1,
    );
    this.penaltyMultiplier = this.configService.get<number>(
      'TRIP_SCORE_PENALTY_MULTIPLIER',
      20,
    );

    this.scoreWeights = {
      overspeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_OVERSPEED',
        1.2,
      ),
      speedLimitViolation: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_SPEED_LIMIT',
        1.1,
      ),
      schoolZoneSpeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_SCHOOL_ZONE',
        1.4,
      ),
      hospitalZoneSpeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HOSPITAL_ZONE',
        1.2,
      ),
      marketZoneSpeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_MARKET_ZONE',
        1.2,
      ),
      harshBrake: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HARSH_BRAKE',
        1.0,
      ),
      harshAccel: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HARSH_ACCEL',
        0.8,
      ),
      harshCorner: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HARSH_CORNER',
        0.8,
      ),
      crash: this.configService.get<number>('TRIP_SCORE_WEIGHT_CRASH', 4.0),
      theftSuspected: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_THEFT_SUSPECTED',
        3.0,
      ),
    };
    this.tripStreamKey =
      this.configService.get<string>('STREAM_TRIPS_KEY', '') || null;
    this.streamMaxLen = this.configService.get<number>('STREAM_MAX_LEN', 10000);
    this.streamEnabled = this.configService.get<boolean>(
      'STREAM_ENABLED',
      true,
    );
  }

  // Updates trip runtime state for each telemetry point and persists completed trips.
  async processTelemetryForTrips(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    if (!device.bikeId) {
      return;
    }

    const state = await this.loadState(device.id);
    const nowMs = Date.parse(payload.ts);

    // Out-of-order protection: discard packets that arrived out of chronological order
    if (state.lastProcessedTs && nowMs < Date.parse(state.lastProcessedTs)) {
      this.logger.debug(
        `Discarding out-of-order telemetry for trip builder for device ${this.truncateDeviceUid(
          device.deviceUid,
        )} (incoming: ${payload.ts}, last processed: ${state.lastProcessedTs})`,
      );
      return;
    }

    state.lastProcessedTs = payload.ts;

    const movingForStart = payload.speedKph >= this.startSpeedKph;
    const movingForEnd = payload.speedKph >= this.endSpeedKph;
    const noMovement = !movingForEnd;

    if (!state.activeStartTs) {
      await this.handleIdleState(
        device.id,
        state,
        payload.ts,
        nowMs,
        movingForStart,
        payload.ignition === true,
      );
      return;
    }

    // Guard: force-finalize trips that exceed the maximum allowed duration (default 12h).
    // This prevents runaway trips caused by faulty ignition wires or GPS drift.
    const tripElapsedSeconds = (nowMs - Date.parse(state.activeStartTs)) / 1000;
    if (tripElapsedSeconds >= this.maxTripDurationSeconds) {
      const activeStartTs = state.activeStartTs;
      await this.clearState(device.id);
      await this.finalizeTrip(device, activeStartTs, payload.ts);
      return;
    }

    if (noMovement) {
      if (!state.idleSinceTs) {
        state.idleSinceTs = payload.ts;
      }
    } else {
      state.idleSinceTs = undefined;
    }

    const shouldEndByIgnition = payload.ignition === false && noMovement;
    const shouldEndByIdle =
      noMovement &&
      !!state.idleSinceTs &&
      nowMs - Date.parse(state.idleSinceTs) >= this.endIdleSeconds * 1000;

    if (!shouldEndByIgnition && !shouldEndByIdle) {
      await this.saveState(device.id, state);
      return;
    }

    const activeStartTs = state.activeStartTs;
    if (!activeStartTs) {
      await this.clearState(device.id);
      return;
    }

    // Determine the correct trip end timestamp:
    // - Idle timeout: use idleSinceTs (when bike actually stopped), NOT the current packet time
    // - Ignition off: use payload.ts (the ignition-off moment)
    const tripEndTs =
      shouldEndByIdle && state.idleSinceTs ? state.idleSinceTs : payload.ts;

    // Set a finalizing lock so concurrent packets don't start a new trip
    // while we're writing this one to the database.
    await this.redisService.set(
      this.finalizingKey(device.id),
      tripEndTs,
      120, // lock TTL: 2 minutes, more than enough for DB write
    );

    // Clear the active state in Redis immediately BEFORE starting the long async database operation
    // to prevent concurrent telemetry packets from triggering duplicate trips for the same start time.
    state.lastTripEndTs = tripEndTs;
    state.activeStartTs = undefined;
    state.candidateStartTs = undefined;
    state.idleSinceTs = undefined;
    await this.saveState(device.id, state);

    await this.finalizeTrip(device, activeStartTs, tripEndTs);

    // Clear the finalizing lock now that the DB write is complete.
    await this.redisService.del(this.finalizingKey(device.id));
  }

  // Applies start conditions while device is currently considered idle.
  private async handleIdleState(
    deviceId: string,
    state: TripRuntimeState,
    payloadTs: string,
    nowMs: number,
    movingForStart: boolean,
    ignitionOn: boolean,
  ): Promise<void> {
    // Block new trip starts while a previous trip is being finalized (race-condition guard).
    const finalizing = await this.redisService.get(
      this.finalizingKey(deviceId),
    );
    if (finalizing) {
      return;
    }

    // Cooldown guard: ignore ignition-on signals within TRIP_COOLDOWN_SEC of the last trip end
    // to prevent ignition bounce from creating duplicate/overlapping trips.
    const inCooldown =
      !!state.lastTripEndTs &&
      nowMs - Date.parse(state.lastTripEndTs) < this.tripCooldownSec * 1000;

    if (ignitionOn && !inCooldown) {
      state.activeStartTs = payloadTs;
      state.candidateStartTs = undefined;
      state.idleSinceTs = undefined;
      await this.saveState(deviceId, state);
      return;
    }

    if (!movingForStart) {
      state.candidateStartTs = undefined;
      await this.saveState(deviceId, state);
      return;
    }

    if (!state.candidateStartTs) {
      state.candidateStartTs = payloadTs;
      await this.saveState(deviceId, state);
      return;
    }

    if (
      nowMs - Date.parse(state.candidateStartTs) >=
      this.startMovementSeconds * 1000
    ) {
      state.activeStartTs = state.candidateStartTs;
      state.candidateStartTs = undefined;
      state.idleSinceTs = undefined;
    }

    await this.saveState(deviceId, state);
  }

  // Persists final trip metrics after end condition is reached.
  private async finalizeTrip(
    device: RuleDeviceContext,
    activeStartTs: string,
    endTs: string,
  ): Promise<void> {
    const startDate = new Date(activeStartTs);
    const endDate = new Date(endTs);
    if (endDate <= startDate) {
      return;
    }

    const tripPoints = await this.prismaService.telemetryPoint.findMany({
      where: {
        deviceId: device.id,
        ts: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        lat: true,
        lng: true,
        batteryPct: true,
      },
      orderBy: { ts: 'asc' },
    });

    const startBatteryPct =
      tripPoints[0]?.batteryPct !== null &&
      tripPoints[0]?.batteryPct !== undefined
        ? Number(tripPoints[0].batteryPct)
        : null;
    const endBatteryPct =
      tripPoints[tripPoints.length - 1]?.batteryPct !== null &&
      tripPoints[tripPoints.length - 1]?.batteryPct !== undefined
        ? Number(tripPoints[tripPoints.length - 1].batteryPct)
        : null;

    const normalizedPoints: TripPoint[] = tripPoints.map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
    }));
    const distanceKm = roundToDecimals(
      this.computeDistanceKm(normalizedPoints),
      3,
    );
    const durationSec = Math.max(
      0,
      Math.floor((endDate.getTime() - startDate.getTime()) / 1000),
    );

    // Discard trips that are too short in distance or duration.
    // These are invariably noise: ignition bounces, GPS jitter, or brief key-on/key-off cycles.
    if (
      distanceKm < this.minTripDistanceKm ||
      durationSec < this.minTripDurationSec
    ) {
      this.logger.debug(
        `Discarding noise trip for device ${this.truncateDeviceUid(
          device.deviceUid,
        )}: distance=${distanceKm}km, duration=${durationSec}s (min: ${this.minTripDistanceKm}km / ${this.minTripDurationSec}s)`,
      );
      return;
    }
    const eventCounts = await this.getTripEventCounts(
      device.id,
      startDate,
      endDate,
    );
    const score = roundToDecimals(
      computeTripScore(
        distanceKm,
        eventCounts,
        this.scoreWeights,
        this.penaltyMultiplier,
        this.minDistanceForScoringKm,
      ),
      2,
    );

    if (!device.bikeId) {
      return;
    }

    const activeAssignment = await this.prismaService.bikeAssignment.findFirst({
      where: {
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        active: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
      select: {
        riderUserId: true,
      },
    });

    // Delete any existing trips for this bike that overlap with the new trip's time range.
    // This eliminates stale/shorter duplicate trips produced by earlier ignition-bounce races.
    const deletedOverlaps = await this.prismaService.trip.deleteMany({
      where: {
        bikeId: device.bikeId,
        // Overlap condition: existing trip starts before new trip ends AND ends after new trip starts
        startTs: { lt: endDate },
        endTs: { gt: startDate },
      },
    });
    if (deletedOverlaps.count > 0) {
      this.logger.warn(
        `Deleted ${deletedOverlaps.count} overlapping trip(s) for device ${this.truncateDeviceUid(device.deviceUid)} before inserting new trip ${startDate.toISOString()} → ${endDate.toISOString()}`,
      );
    }

    let createdTrip;
    try {
      createdTrip = await this.prismaService.trip.create({
        data: {
          fleetId: device.fleetId,
          bikeId: device.bikeId,
          riderId: activeAssignment?.riderUserId ?? null,
          startTs: startDate,
          endTs: endDate,
          distanceKm,
          durationSec,
          score,
          startBatteryPct,
          endBatteryPct,
        },
      });
    } catch (error: unknown) {
      // Silently discard duplicate trips (unique constraint violation on bikeId + startTs)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Duplicate trip discarded for device ${this.truncateDeviceUid(device.deviceUid)} startTs=${startDate.toISOString()}`,
        );
        return;
      }
      throw error;
    }

    await this.publishTripSummary(createdTrip);

    this.logger.debug(
      `Trip finalized for device ${this.truncateDeviceUid(device.deviceUid)} score=${score.toFixed(2)}`,
    );
  }

  // Publishes completed trip summaries to the trips stream for downstream consumers.
  private async publishTripSummary(trip: {
    id: string;
    fleetId: string;
    bikeId: string;
    riderId: string | null;
    startTs: Date;
    endTs: Date | null;
    distanceKm: Prisma.Decimal | number;
    durationSec: number;
    score: Prisma.Decimal | number;
  }): Promise<void> {
    if (!this.streamEnabled || !this.tripStreamKey) {
      return;
    }

    const distanceKm = Number(trip.distanceKm);
    const score = Number(trip.score);
    const endTs = trip.endTs ?? trip.startTs;

    await this.redisService.addToStream(
      this.tripStreamKey,
      {
        kind: 'trip_summary',
        tripId: trip.id,
        fleetId: trip.fleetId,
        bikeId: trip.bikeId,
        riderId: trip.riderId ?? '',
        startTs: trip.startTs.toISOString(),
        endTs: endTs.toISOString(),
        distanceKm: Number.isFinite(distanceKm) ? distanceKm.toString() : '0',
        durationSec: trip.durationSec.toString(),
        score: Number.isFinite(score) ? score.toString() : '0',
      },
      this.streamMaxLen,
    );
  }

  // Aggregates counted events in the trip timespan for scoring calculation.
  private async getTripEventCounts(
    deviceId: string,
    startTs: Date,
    endTs: Date,
  ) {
    const groupedRows = await this.prismaService.event.groupBy({
      by: ['type'],
      where: {
        deviceId,
        ts: {
          gte: startTs,
          lte: endTs,
        },
      },
      _count: {
        _all: true,
      },
    });

    return normalizeTripEventCounts(
      groupedRows.map((row) => ({ type: row.type, count: row._count._all })),
    );
  }

  // Computes cumulative haversine distance across ordered telemetry points.
  private computeDistanceKm(points: TripPoint[]): number {
    if (points.length < 2) {
      return 0;
    }

    let totalDistanceKm = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      totalDistanceKm += haversineDistanceKm(
        previous.lat,
        previous.lng,
        current.lat,
        current.lng,
      );
    }

    return totalDistanceKm;
  }

  // Loads persisted Redis runtime state for a device trip session.
  private async loadState(deviceId: string): Promise<TripRuntimeState> {
    const rawState = await this.redisService.get(this.stateKey(deviceId));
    if (!rawState) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawState) as TripRuntimeState;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  // Writes runtime trip state to Redis with short retention.
  private async saveState(
    deviceId: string,
    state: TripRuntimeState,
  ): Promise<void> {
    await this.redisService.set(
      this.stateKey(deviceId),
      JSON.stringify(state),
      60 * 60 * 24,
    );
  }

  // Clears runtime trip state when a trip ends.
  private async clearState(deviceId: string): Promise<void> {
    await this.redisService.del(this.stateKey(deviceId));
  }

  // Produces redis key names for per-device trip runtime state.
  private stateKey(deviceId: string): string {
    return `trip:state:${deviceId}`;
  }

  // Produces redis key for the per-device finalizing lock.
  private finalizingKey(deviceId: string): string {
    return `trip:finalizing:${deviceId}`;
  }

  // Produces a truncated device identifier safe for operational logs.
  private truncateDeviceUid(deviceUid: string): string {
    if (deviceUid.length <= 8) {
      return `${deviceUid.slice(0, 2)}***${deviceUid.slice(-2)}`;
    }

    return `${deviceUid.slice(0, 4)}...${deviceUid.slice(-4)}`;
  }
}
