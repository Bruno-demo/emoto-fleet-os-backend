import { Injectable, Logger } from '@nestjs/common';
import { EventSeverity, GeofenceZone, Prisma, ZoneType } from '@prisma/client';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { TelemetryPayload } from '../mqtt/mqtt-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsService } from '../events/events.service';
import { polygonGeoJsonSchema } from '../zones/geojson.schema';

const OVERSPEED_MIN_DURATION_MS = 5_000;
const OVERSPEED_STATE_TTL_SECONDS = 120;
const HARSH_EVENT_COOLDOWN_SECONDS = 8;
const CRASH_EVENT_COOLDOWN_SECONDS = 180;
const THEFT_EVENT_COOLDOWN_SECONDS = 300;
const THEFT_MOVEMENT_SECONDS = 20;
const MOVEMENT_SPEED_THRESHOLD_KPH = 3;
const HARSH_BRAKE_THRESHOLD = -4.0;
const HARSH_ACCEL_THRESHOLD = 4.0;
const HARSH_CORNER_THRESHOLD = 3.5;
const CRASH_G_FORCE_THRESHOLD = 2.8;
const CRASH_SPEED_DROP_THRESHOLD_KPH = 20;
const CRASH_TILT_Z_THRESHOLD = 4.5;
const NIGHT_START_HOUR_UTC = 22;
const NIGHT_END_HOUR_UTC = 5;
const LAST_SPEED_STATE_TTL_SECONDS = 600;

export interface RuleDeviceContext {
  id: string;
  fleetId: string;
  bikeId: string | null;
  deviceUid: string;
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventsService: EventsService,
  ) {}

  // Evaluates all configured safety/security rules for one telemetry message.
  async evaluateTelemetry(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    const activeZones = await this.loadActiveZones(device.fleetId);
    const insideZoneIds = this.resolveContainingZoneIds(payload, activeZones);
    const insideParkZone = activeZones.some(
      (zone) => zone.type === ZoneType.PARK && insideZoneIds.has(zone.id),
    );

    await this.evaluateOverspeed(device, payload, activeZones, insideZoneIds);
    await this.evaluateHarshDynamics(device, payload);
    await this.evaluateCrash(device, payload);
    await this.evaluateTheft(device, payload, insideParkZone);
    await this.storeLastSpeedState(device, payload);
  }

  // Loads active SLOW and PARK zones used in current telemetry rule checks.
  private async loadActiveZones(fleetId: string): Promise<GeofenceZone[]> {
    return this.prismaService.geofenceZone.findMany({
      where: {
        fleetId,
        active: true,
        type: {
          in: [ZoneType.SLOW, ZoneType.PARK],
        },
      },
    });
  }

  // Finds which zones contain the incoming point based on polygon geometry.
  private resolveContainingZoneIds(
    payload: TelemetryPayload,
    zones: GeofenceZone[],
  ): Set<string> {
    const containingZoneIds = new Set<string>();
    const locationPoint = point([payload.lng, payload.lat]);

    for (const zone of zones) {
      const parsedPolygon = polygonGeoJsonSchema.safeParse(zone.geojsonPolygon);
      if (!parsedPolygon.success) {
        this.logger.warn(`Skipping invalid zone geometry: ${zone.id}`);
        continue;
      }

      if (booleanPointInPolygon(locationPoint, parsedPolygon.data)) {
        containingZoneIds.add(zone.id);
      }
    }

    return containingZoneIds;
  }

  // Emits OVERSPEED when speed exceeds zone limit for at least 5 seconds.
  private async evaluateOverspeed(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
    zones: GeofenceZone[],
    insideZoneIds: Set<string>,
  ): Promise<void> {
    const nowMs = Date.parse(payload.ts);
    const slowZones = zones.filter((zone) => zone.type === ZoneType.SLOW);

    for (const zone of slowZones) {
      const speedLimit = zone.speedLimitKph?.toNumber();
      if (!speedLimit) {
        continue;
      }

      const overLimit =
        insideZoneIds.has(zone.id) && payload.speedKph > speedLimit;
      const startKey = this.overspeedStartKey(device.id, zone.id);
      const activeKey = this.overspeedActiveKey(device.id, zone.id);

      if (!overLimit) {
        await this.redisService.del(startKey);
        await this.redisService.del(activeKey);
        continue;
      }

      const startTs = await this.redisService.get(startKey);
      if (!startTs) {
        await this.redisService.set(
          startKey,
          payload.ts,
          OVERSPEED_STATE_TTL_SECONDS,
        );
        continue;
      }

      const elapsedMs = nowMs - Date.parse(startTs);
      if (elapsedMs < OVERSPEED_MIN_DURATION_MS) {
        continue;
      }

      const activated = await this.redisService.setIfNotExists(
        activeKey,
        '1',
        OVERSPEED_STATE_TTL_SECONDS,
      );
      if (!activated) {
        continue;
      }

      await this.eventsService.createFleetEvent({
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        deviceId: device.id,
        ts: new Date(payload.ts),
        type: 'OVERSPEED',
        severity: EventSeverity.MEDIUM,
        metaJson: {
          zoneId: zone.id,
          zoneName: zone.name,
          speedKph: payload.speedKph,
          speedLimitKph: speedLimit,
          durationMs: elapsedMs,
        } as Prisma.InputJsonValue,
      });
    }
  }

  // Emits harsh dynamics events when accel thresholds are exceeded.
  private async evaluateHarshDynamics(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    if (!payload.accel) {
      return;
    }

    if (payload.accel.x <= HARSH_BRAKE_THRESHOLD) {
      await this.emitWithCooldown(
        this.eventCooldownKey(device.id, 'HARSH_BRAKE'),
        HARSH_EVENT_COOLDOWN_SECONDS,
        {
          fleetId: device.fleetId,
          bikeId: device.bikeId,
          deviceId: device.id,
          ts: new Date(payload.ts),
          type: 'HARSH_BRAKE',
          severity: EventSeverity.MEDIUM,
          metaJson: {
            accelX: payload.accel.x,
            threshold: HARSH_BRAKE_THRESHOLD,
          } as Prisma.InputJsonValue,
        },
      );
    }

    if (payload.accel.x >= HARSH_ACCEL_THRESHOLD) {
      await this.emitWithCooldown(
        this.eventCooldownKey(device.id, 'HARSH_ACCEL'),
        HARSH_EVENT_COOLDOWN_SECONDS,
        {
          fleetId: device.fleetId,
          bikeId: device.bikeId,
          deviceId: device.id,
          ts: new Date(payload.ts),
          type: 'HARSH_ACCEL',
          severity: EventSeverity.MEDIUM,
          metaJson: {
            accelX: payload.accel.x,
            threshold: HARSH_ACCEL_THRESHOLD,
          } as Prisma.InputJsonValue,
        },
      );
    }

    if (Math.abs(payload.accel.y) >= HARSH_CORNER_THRESHOLD) {
      await this.emitWithCooldown(
        this.eventCooldownKey(device.id, 'HARSH_CORNER'),
        HARSH_EVENT_COOLDOWN_SECONDS,
        {
          fleetId: device.fleetId,
          bikeId: device.bikeId,
          deviceId: device.id,
          ts: new Date(payload.ts),
          type: 'HARSH_CORNER',
          severity: EventSeverity.MEDIUM,
          metaJson: {
            accelY: payload.accel.y,
            threshold: HARSH_CORNER_THRESHOLD,
          } as Prisma.InputJsonValue,
        },
      );
    }
  }

  // Emits CRASH when high g-force combines with speed drop and tilt indication.
  private async evaluateCrash(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    if (!payload.accel) {
      return;
    }

    const previousState = await this.loadPreviousSpeed(device.id);
    if (!previousState) {
      return;
    }

    const speedDrop = previousState.speedKph - payload.speedKph;
    const totalAccel = Math.sqrt(
      payload.accel.x ** 2 + payload.accel.y ** 2 + payload.accel.z ** 2,
    );
    const gForce = totalAccel / 9.81;
    const tiltDetected = Math.abs(payload.accel.z) <= CRASH_TILT_Z_THRESHOLD;

    if (
      gForce < CRASH_G_FORCE_THRESHOLD ||
      speedDrop < CRASH_SPEED_DROP_THRESHOLD_KPH ||
      !tiltDetected
    ) {
      return;
    }

    await this.emitWithCooldown(
      this.eventCooldownKey(device.id, 'CRASH'),
      CRASH_EVENT_COOLDOWN_SECONDS,
      {
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        deviceId: device.id,
        ts: new Date(payload.ts),
        type: 'CRASH',
        severity: EventSeverity.CRITICAL,
        metaJson: {
          gForce,
          speedDropKph: speedDrop,
          accelZ: payload.accel.z,
        } as Prisma.InputJsonValue,
      },
    );
  }

  // Emits THEFT_SUSPECTED for ignition-off movement or park-zone night violations.
  private async evaluateTheft(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
    insideParkZone: boolean,
  ): Promise<void> {
    await this.evaluateIgnitionOffMovementTheft(device, payload);

    const moving = payload.speedKph > MOVEMENT_SPEED_THRESHOLD_KPH;
    if (!moving || !this.isNightUtc(payload.ts) || insideParkZone) {
      return;
    }

    await this.emitWithCooldown(
      this.eventCooldownKey(device.id, 'THEFT_NIGHT_OUTSIDE_PARK'),
      THEFT_EVENT_COOLDOWN_SECONDS,
      {
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        deviceId: device.id,
        ts: new Date(payload.ts),
        type: 'THEFT_SUSPECTED',
        severity: EventSeverity.HIGH,
        metaJson: {
          reason: 'outside_park_zone_at_night',
          speedKph: payload.speedKph,
        } as Prisma.InputJsonValue,
      },
    );
  }

  // Tracks ignition-off movement duration and emits theft when threshold is exceeded.
  private async evaluateIgnitionOffMovementTheft(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    const movementDetected =
      payload.ignition === false &&
      payload.speedKph > MOVEMENT_SPEED_THRESHOLD_KPH;
    const startKey = this.theftMovementStartKey(device.id);
    const activeKey = this.theftMovementActiveKey(device.id);

    if (!movementDetected) {
      await this.redisService.del(startKey);
      await this.redisService.del(activeKey);
      return;
    }

    const nowMs = Date.parse(payload.ts);
    const movementStartTs = await this.redisService.get(startKey);
    if (!movementStartTs) {
      await this.redisService.set(
        startKey,
        payload.ts,
        THEFT_EVENT_COOLDOWN_SECONDS,
      );
      return;
    }

    const elapsedMs = nowMs - Date.parse(movementStartTs);
    if (elapsedMs < THEFT_MOVEMENT_SECONDS * 1_000) {
      return;
    }

    const activated = await this.redisService.setIfNotExists(
      activeKey,
      '1',
      THEFT_EVENT_COOLDOWN_SECONDS,
    );
    if (!activated) {
      return;
    }

    await this.eventsService.createFleetEvent({
      fleetId: device.fleetId,
      bikeId: device.bikeId,
      deviceId: device.id,
      ts: new Date(payload.ts),
      type: 'THEFT_SUSPECTED',
      severity: EventSeverity.HIGH,
      metaJson: {
        reason: 'movement_while_ignition_off',
        speedKph: payload.speedKph,
        durationMs: elapsedMs,
      } as Prisma.InputJsonValue,
    });
  }

  // Emits a fleet event only once per cooldown window using Redis NX keys.
  private async emitWithCooldown(
    cooldownKey: string,
    cooldownSeconds: number,
    eventInput: Parameters<EventsService['createFleetEvent']>[0],
  ): Promise<void> {
    const firstOccurrence = await this.redisService.setIfNotExists(
      cooldownKey,
      '1',
      cooldownSeconds,
    );
    if (!firstOccurrence) {
      return;
    }

    await this.eventsService.createFleetEvent(eventInput);
  }

  // Stores the most recent speed sample for crash speed-drop calculations.
  private async storeLastSpeedState(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    await this.redisService.set(
      this.lastSpeedStateKey(device.id),
      JSON.stringify({
        speedKph: payload.speedKph,
        ts: payload.ts,
      }),
      LAST_SPEED_STATE_TTL_SECONDS,
    );
  }

  // Loads the previous speed sample from Redis.
  private async loadPreviousSpeed(
    deviceId: string,
  ): Promise<{ speedKph: number; ts: string } | null> {
    const rawValue = await this.redisService.get(
      this.lastSpeedStateKey(deviceId),
    );
    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as { speedKph: number; ts: string };
      if (
        typeof parsed.speedKph !== 'number' ||
        typeof parsed.ts !== 'string'
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  // Determines whether timestamp falls into the configured UTC night interval.
  private isNightUtc(ts: string): boolean {
    const hour = new Date(ts).getUTCHours();
    if (NIGHT_START_HOUR_UTC > NIGHT_END_HOUR_UTC) {
      return hour >= NIGHT_START_HOUR_UTC || hour < NIGHT_END_HOUR_UTC;
    }

    return hour >= NIGHT_START_HOUR_UTC && hour < NIGHT_END_HOUR_UTC;
  }

  // Creates a Redis key for overspeed start-state tracking.
  private overspeedStartKey(deviceId: string, zoneId: string): string {
    return `rules:overspeed:start:${deviceId}:${zoneId}`;
  }

  // Creates a Redis key for overspeed active-state cooldown.
  private overspeedActiveKey(deviceId: string, zoneId: string): string {
    return `rules:overspeed:active:${deviceId}:${zoneId}`;
  }

  // Creates a Redis key for event cooldown tracking.
  private eventCooldownKey(deviceId: string, eventType: string): string {
    return `rules:cooldown:${deviceId}:${eventType}`;
  }

  // Creates a Redis key for theft movement start-state tracking.
  private theftMovementStartKey(deviceId: string): string {
    return `rules:theft:movement:start:${deviceId}`;
  }

  // Creates a Redis key for theft movement active-state cooldown.
  private theftMovementActiveKey(deviceId: string): string {
    return `rules:theft:movement:active:${deviceId}`;
  }

  // Creates a Redis key for previous speed samples used by crash logic.
  private lastSpeedStateKey(deviceId: string): string {
    return `rules:last-speed:${deviceId}`;
  }
}
