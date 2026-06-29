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

    await this.finalizeTrip(device, activeStartTs, payload.ts);
    await this.clearState(device.id);
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
    if (ignitionOn) {
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

    const startBatteryPct = tripPoints[0]?.batteryPct
      ? Number(tripPoints[0].batteryPct)
      : null;
    const endBatteryPct = tripPoints[tripPoints.length - 1]?.batteryPct
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

    // Discard static/dummy trips (e.g. ignition on/off cycles without movement)
    if (distanceKm < 0.05) {
      this.logger.debug(
        `Discarding dummy trip for device ${this.truncateDeviceUid(
          device.deviceUid,
        )}: distance=${distanceKm} km, duration=${durationSec}s`,
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

    const createdTrip = await this.prismaService.trip.create({
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

  // Produces a truncated device identifier safe for operational logs.
  private truncateDeviceUid(deviceUid: string): string {
    if (deviceUid.length <= 8) {
      return `${deviceUid.slice(0, 2)}***${deviceUid.slice(-2)}`;
    }

    return `${deviceUid.slice(0, 4)}...${deviceUid.slice(-4)}`;
  }
}
