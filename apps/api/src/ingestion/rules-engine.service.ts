import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventSeverity,
  GeofenceZone,
  Prisma,
  RoadFeatureType,
  ZoneType,
} from '@prisma/client';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { TelemetryPayload } from '../mqtt/mqtt-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsService } from '../events/events.service';
import { RoadFeaturesService } from '../roads/roads.service';
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
const ROAD_EVENT_COOLDOWN_SECONDS = 60;
const DEFAULT_ROAD_SPEED_LIMIT_RADIUS_METERS = 80;
const DEFAULT_ROAD_SAFETY_RADIUS_METERS = 200;
const DEFAULT_ROAD_SPEED_TOLERANCE_KPH = 5;

export interface RuleDeviceContext {
  id: string;
  fleetId: string;
  bikeId: string | null;
  deviceUid: string;
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);
  private readonly roadSpeedLimitRadiusMeters: number;
  private readonly roadSafetyRadiusMeters: number;
  private readonly roadSpeedToleranceKph: number;
  private readonly schoolZoneSpeedKph: number;
  private readonly hospitalZoneSpeedKph: number;
  private readonly marketZoneSpeedKph: number;
  private readonly rulesStreamKey: string | null;
  private readonly streamMaxLen: number;
  private readonly streamEnabled: boolean;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventsService: EventsService,
    private readonly roadFeaturesService: RoadFeaturesService,
    private readonly configService: ConfigService,
  ) {
    this.roadSpeedLimitRadiusMeters = this.configService.get<number>(
      'ROAD_SPEED_LIMIT_RADIUS_METERS',
      DEFAULT_ROAD_SPEED_LIMIT_RADIUS_METERS,
    );
    this.roadSafetyRadiusMeters = this.configService.get<number>(
      'ROAD_SAFETY_RADIUS_METERS',
      DEFAULT_ROAD_SAFETY_RADIUS_METERS,
    );
    this.roadSpeedToleranceKph = this.configService.get<number>(
      'ROAD_SPEED_TOLERANCE_KPH',
      DEFAULT_ROAD_SPEED_TOLERANCE_KPH,
    );
    this.schoolZoneSpeedKph = this.configService.get<number>(
      'ROAD_SCHOOL_SPEED_KPH',
      30,
    );
    this.hospitalZoneSpeedKph = this.configService.get<number>(
      'ROAD_HOSPITAL_SPEED_KPH',
      30,
    );
    this.marketZoneSpeedKph = this.configService.get<number>(
      'ROAD_MARKET_SPEED_KPH',
      25,
    );
    this.rulesStreamKey =
      this.configService.get<string>('STREAM_RULES_KEY', '') || null;
    this.streamMaxLen = this.configService.get<number>('STREAM_MAX_LEN', 10000);
    this.streamEnabled = this.configService.get<boolean>(
      'STREAM_ENABLED',
      true,
    );
  }

  // Evaluates all configured safety/security rules for one telemetry message.
  async evaluateTelemetry(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    let activeZones: GeofenceZone[] = [];
    let insideZoneIds = new Set<string>();
    let insideParkZone = false;

    try {
      activeZones = await this.loadActiveZones(device.fleetId);
      insideZoneIds = this.resolveContainingZoneIds(payload, activeZones);
      insideParkZone = activeZones.some(
        (zone) => zone.type === ZoneType.PARK && insideZoneIds.has(zone.id),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Zone loading failed for device=${device.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    const evaluations: Array<[string, () => Promise<void>]> = [
      [
        'overspeed',
        () =>
          this.evaluateOverspeed(device, payload, activeZones, insideZoneIds),
      ],
      ['harshDynamics', () => this.evaluateHarshDynamics(device, payload)],
      ['crash', () => this.evaluateCrash(device, payload)],
      ['theft', () => this.evaluateTheft(device, payload, insideParkZone)],
      ['roadSafety', () => this.evaluateRoadSafety(device, payload)],
    ];

    for (const [name, evaluate] of evaluations) {
      try {
        await evaluate();
      } catch (error: unknown) {
        this.logger.error(
          `Rule "${name}" failed for device=${device.id}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }

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

      await this.createRuleEvent({
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
      const prev = await this.loadPreviousSpeed(device.id);
      if (!prev) {
        return;
      }

      const timeDeltaMs = Date.parse(payload.ts) - Date.parse(prev.ts);
      if (timeDeltaMs <= 0 || timeDeltaMs > 30000) {
        return;
      }

      const speedDeltaKph = payload.speedKph - prev.speedKph;
      const speedDeltaMs = speedDeltaKph / 3.6;
      const timeDeltaSeconds = timeDeltaMs / 1000;
      
      // Cap the divisor to 2.5s for harsh dynamics calculations. This represents the typical 
      // duration of a hard braking/accel event, preventing G-force dilution over the packet interval.
      const effectiveTimeDelta = Math.min(timeDeltaSeconds, 2.5);
      const acceleration = speedDeltaMs / effectiveTimeDelta;
      const gForce = acceleration / 9.81;

      const SOFTWARE_BRAKE_G_THRESHOLD = -0.35;
      const SOFTWARE_ACCEL_G_THRESHOLD = 0.25;

      if (gForce <= SOFTWARE_BRAKE_G_THRESHOLD) {
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
              gpsGForce: Number(gForce.toFixed(3)),
              speedDeltaKph: Number(speedDeltaKph.toFixed(2)),
              timeDeltaSeconds: Number(timeDeltaSeconds.toFixed(2)),
              threshold: SOFTWARE_BRAKE_G_THRESHOLD,
            } as Prisma.InputJsonValue,
          },
        );
      }

      if (gForce >= SOFTWARE_ACCEL_G_THRESHOLD) {
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
              gpsGForce: Number(gForce.toFixed(3)),
              speedDeltaKph: Number(speedDeltaKph.toFixed(2)),
              timeDeltaSeconds: Number(timeDeltaSeconds.toFixed(2)),
              threshold: SOFTWARE_ACCEL_G_THRESHOLD,
            } as Prisma.InputJsonValue,
          },
        );
      }
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
      const previousState = await this.loadPreviousSpeed(device.id);
      if (!previousState) {
        return;
      }

      const timeDeltaMs = Date.parse(payload.ts) - Date.parse(previousState.ts);
      if (timeDeltaMs <= 0 || timeDeltaMs > 30000) {
        return;
      }

      const speedDropKph = previousState.speedKph - payload.speedKph;
      const speedDropMs = speedDropKph / 3.6;
      const timeDeltaSeconds = timeDeltaMs / 1000;
      
      // Cap the divisor to 1.5s to calculate impact intensity rather than averaging over the packet interval
      const effectiveTimeDelta = Math.min(timeDeltaSeconds, 1.5);
      const deceleration = speedDropMs / effectiveTimeDelta;
      const gForce = deceleration / 9.81;

      const SOFTWARE_CRASH_G_THRESHOLD = 1.0;

      if (gForce >= SOFTWARE_CRASH_G_THRESHOLD) {
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
              gForce: Number(gForce.toFixed(3)),
              speedDropKph: Number(speedDropKph.toFixed(2)),
              timeDeltaSeconds: Number(timeDeltaSeconds.toFixed(2)),
            } as Prisma.InputJsonValue,
          },
        );
      }
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

    // Robust multi-path crash detection for insurance reliability:
    // 1. Major collision: High impact G-force combined with a sudden deceleration.
    // 2. Slide/Fall: High impact G-force accompanied by a tilt event (Z-axis drop).
    const isMajorCollision = gForce >= CRASH_G_FORCE_THRESHOLD && speedDrop >= CRASH_SPEED_DROP_THRESHOLD_KPH;
    const isSlideOrFall = gForce >= CRASH_G_FORCE_THRESHOLD && tiltDetected;

    if (!isMajorCollision && !isSlideOrFall) {
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

  // Emits speed-limit and sensitive-zone violations using OSM road feature data.
  private async evaluateRoadSafety(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
  ): Promise<void> {
    const radiusMeters = Math.max(
      this.roadSafetyRadiusMeters,
      this.roadSpeedLimitRadiusMeters,
    );
    const nearbyFeatures = await this.roadFeaturesService.getNearbyFeatures(
      payload.lat,
      payload.lng,
      radiusMeters,
    );

    await this.evaluateSpeedLimitViolation(device, payload, nearbyFeatures);
    await this.evaluateSensitiveZoneViolations(device, payload, nearbyFeatures);
  }

  // Emits SPEED_LIMIT_VIOLATION when nearby maxspeed tags are exceeded.
  private async evaluateSpeedLimitViolation(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
    features: Array<{
      id: string;
      type: RoadFeatureType;
      speedLimitKph: number | null;
      lat: number;
      lng: number;
    }>,
  ): Promise<void> {
    const nearest = findNearestFeature(
      features.filter(
        (feature) =>
          feature.type === RoadFeatureType.SPEED_LIMIT &&
          feature.speedLimitKph !== null,
      ),
      payload.lat,
      payload.lng,
      this.roadSpeedLimitRadiusMeters,
    );

    // Default national speed limit fallback is 60 km/h
    const speedLimit = nearest?.speedLimitKph ?? 60;
    const featureId = nearest?.id ?? 'default_national_limit';

    if (payload.speedKph <= speedLimit + this.roadSpeedToleranceKph) {
      return;
    }

    await this.emitWithCooldown(
      this.eventCooldownKey(device.id, `SPEED_LIMIT_${featureId}`),
      ROAD_EVENT_COOLDOWN_SECONDS,
      {
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        deviceId: device.id,
        ts: new Date(payload.ts),
        type: 'SPEED_LIMIT_VIOLATION',
        severity: EventSeverity.MEDIUM,
        metaJson: {
          speedKph: payload.speedKph,
          speedLimitKph: speedLimit,
          featureId,
          distanceMeters: nearest?.distanceMeters ?? 0,
        } as Prisma.InputJsonValue,
      },
    );
  }

  // Emits SCHOOL/HOSPITAL/MARKET zone violations for nearby sensitive POIs.
  private async evaluateSensitiveZoneViolations(
    device: RuleDeviceContext,
    payload: TelemetryPayload,
    features: Array<{
      id: string;
      type: RoadFeatureType;
      speedLimitKph: number | null;
      lat: number;
      lng: number;
    }>,
  ): Promise<void> {
    const zones = [
      {
        type: RoadFeatureType.SCHOOL,
        eventType: 'SCHOOL_ZONE_SPEED' as const,
        severity: EventSeverity.HIGH,
        speedLimitKph: this.schoolZoneSpeedKph,
      },
      {
        type: RoadFeatureType.HOSPITAL,
        eventType: 'HOSPITAL_ZONE_SPEED' as const,
        severity: EventSeverity.MEDIUM,
        speedLimitKph: this.hospitalZoneSpeedKph,
      },
      {
        type: RoadFeatureType.MARKET,
        eventType: 'MARKET_ZONE_SPEED' as const,
        severity: EventSeverity.MEDIUM,
        speedLimitKph: this.marketZoneSpeedKph,
      },
    ];

    for (const zone of zones) {
      if (payload.speedKph <= zone.speedLimitKph + this.roadSpeedToleranceKph) {
        continue;
      }

      const nearest = findNearestFeature(
        features.filter((feature) => feature.type === zone.type),
        payload.lat,
        payload.lng,
        this.roadSafetyRadiusMeters,
      );
      if (!nearest) {
        continue;
      }

      await this.emitWithCooldown(
        this.eventCooldownKey(device.id, `${zone.eventType}_${nearest.id}`),
        ROAD_EVENT_COOLDOWN_SECONDS,
        {
          fleetId: device.fleetId,
          bikeId: device.bikeId,
          deviceId: device.id,
          ts: new Date(payload.ts),
          type: zone.eventType,
          severity: zone.severity,
          metaJson: {
            speedKph: payload.speedKph,
            speedLimitKph: zone.speedLimitKph,
            featureId: nearest.id,
            distanceMeters: nearest.distanceMeters,
            featureType: zone.type,
          } as Prisma.InputJsonValue,
        },
      );
    }
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

    await this.createRuleEvent({
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

    await this.createRuleEvent(eventInput);
  }

  // Persists rule-generated events and publishes them to the rules stream.
  private async createRuleEvent(
    eventInput: Parameters<EventsService['createFleetEvent']>[0],
  ): Promise<void> {
    const createdEvent = await this.eventsService.createFleetEvent(eventInput);
    if (!this.streamEnabled || !this.rulesStreamKey) {
      return;
    }

    try {
      await this.redisService.addToStream(
        this.rulesStreamKey,
        {
          kind: 'rule_event',
          eventId: createdEvent.id,
          fleetId: createdEvent.fleetId,
          bikeId: createdEvent.bikeId ?? '',
          deviceId: createdEvent.deviceId,
          ts: createdEvent.ts.toISOString(),
          type: createdEvent.type,
          severity: createdEvent.severity,
          metaJson: JSON.stringify(createdEvent.metaJson ?? {}),
        },
        this.streamMaxLen,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to publish rule_event stream for event=${createdEvent.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
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

// Finds the nearest feature within the requested radius for road-safety checks.
function findNearestFeature(
  features: Array<{
    id: string;
    lat: number;
    lng: number;
    speedLimitKph: number | null;
  }>,
  lat: number,
  lng: number,
  radiusMeters: number,
): {
  id: string;
  lat: number;
  lng: number;
  speedLimitKph: number | null;
  distanceMeters: number;
} | null {
  let nearest: {
    id: string;
    lat: number;
    lng: number;
    speedLimitKph: number | null;
    distanceMeters: number;
  } | null = null;

  for (const feature of features) {
    const distanceMeters = haversineDistanceMeters(
      lat,
      lng,
      feature.lat,
      feature.lng,
    );
    if (distanceMeters > radiusMeters) {
      continue;
    }
    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { ...feature, distanceMeters };
    }
  }

  return nearest;
}

// Calculates haversine distance between two points in meters.
function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c * 1000;
}
