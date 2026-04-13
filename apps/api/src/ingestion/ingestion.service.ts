import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus, EventSeverity, Prisma } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import mqtt, { IClientOptions, MqttClient } from 'mqtt';
import { CommandsService } from '../commands/commands.service';
import {
  decryptDeviceSecret,
  hashDeviceSecret,
} from '../crypto/device-secret.crypto';
import { EventsService } from '../events/events.service';
import {
  EventPayload,
  MqttValidationError,
  TelemetryPayload,
  assertNonceNotReplayed,
  assertTimestampDrift,
  commandAckPayloadSchema,
  eventPayloadSchema,
  parseMqttTopic,
  telemetryPayloadSchema,
  verifyPayloadSignature,
  CommandAckPayload,
} from '../mqtt/mqtt-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';
import { LiveBikeState } from './ingestion.types';
import { LiveStateService } from './live-state.service';
import { RulesEngineService } from './rules-engine.service';
import { TripBuilderService } from './trip-builder.service';

interface DeviceForIngestion {
  id: string;
  fleetId: string;
  bikeId: string | null;
  deviceUid: string;
  status: DeviceStatus;
  secretHash: string;
  secretEncrypted: string | null;
}

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private readonly mqttUrl: string;
  private readonly deviceSecretMasterKey: string;
  private readonly mqttDisabled: boolean;
  private readonly streamKey: string | null;
  private readonly streamMaxLen: number;
  private readonly streamEnabled: boolean;
  private mqttClient: MqttClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly liveStateService: LiveStateService,
    private readonly rulesEngineService: RulesEngineService,
    private readonly eventsService: EventsService,
    private readonly tripBuilderService: TripBuilderService,
    private readonly commandsService: CommandsService,
    private readonly metricsService: MetricsService,
  ) {
    this.mqttUrl = this.configService.getOrThrow<string>('MQTT_URL');
    this.deviceSecretMasterKey = this.configService.getOrThrow<string>(
      'DEVICE_SECRET_MASTER_KEY',
    );
    this.mqttDisabled = this.configService.get<boolean>('MQTT_DISABLED', false);
    this.streamKey = this.configService.get<string>('STREAM_KEY', '') || null;
    this.streamMaxLen = this.configService.get<number>('STREAM_MAX_LEN', 10000);
    this.streamEnabled = this.configService.get<boolean>('STREAM_ENABLED', true);
  }

  // Opens MQTT connection and subscribes to ingestion topics.
  onModuleInit(): void {
    if (this.mqttDisabled) {
      this.logger.log('MQTT ingestion disabled by configuration');
      return;
    }

    const options: IClientOptions = {
      reconnectPeriod: 3_000,
      connectTimeout: 10_000,
    };

    this.mqttClient = mqtt.connect(this.mqttUrl, options);

    this.mqttClient.on('connect', () => {
      this.subscribeToTopics();
    });

    this.mqttClient.on('message', (topic: string, payload: Buffer) => {
      void this.handleIncomingMessage(topic, payload.toString('utf8'));
    });

    this.mqttClient.on('error', (error: Error) => {
      this.logger.warn(`MQTT client error: ${error.message}`);
    });
  }

  // Closes MQTT connection during graceful shutdown.
  onModuleDestroy(): void {
    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }
  }

  // Subscribes to wildcard telemetry, event, and command-ack topics.
  private subscribeToTopics(): void {
    if (!this.mqttClient) {
      return;
    }

    const topics = [
      'v1/devices/+/telemetry',
      'v1/devices/+/event',
      'v1/devices/+/command-ack',
    ];
    this.mqttClient.subscribe(topics, { qos: 1 }, (error: Error | null) => {
      if (error) {
        this.logger.warn(`MQTT subscribe failed: ${error.message}`);
        return;
      }

      this.logger.log(`Subscribed to MQTT topics: ${topics.join(', ')}`);
    });
  }

  // Routes a raw MQTT message through verification, validation, and persistence.
  private async handleIncomingMessage(
    topic: string,
    rawMessage: string,
  ): Promise<void> {
    const parsedTopic = parseMqttTopic(topic);
    if (!parsedTopic) {
      return;
    }

    const kindLabel =
      parsedTopic.kind === 'commandAck' ? 'command_ack' : parsedTopic.kind;

    try {
      const payload = JSON.parse(rawMessage) as unknown;
      const device = await this.loadDeviceByUid(parsedTopic.deviceUid);
      if (!device || device.status !== 'ACTIVE') {
        this.metricsService.incrementMqttIngestion(kindLabel, 'rejected', 'unknown_device');
        this.logger.warn(
          `Ignoring message from unknown/inactive device ${this.truncateDeviceUid(parsedTopic.deviceUid)}`,
        );
        return;
      }

      const deviceSecret = this.decryptAndValidateSecret(device);

      if (parsedTopic.kind === 'telemetry') {
        await this.processTelemetryPayload(device, payload, deviceSecret);
      } else if (parsedTopic.kind === 'event') {
        await this.processEventPayload(device, payload, deviceSecret);
      } else {
        await this.processCommandAckPayload(device, payload, deviceSecret);
      }
      this.metricsService.incrementMqttIngestion(kindLabel, 'accepted');
    } catch (error: unknown) {
      const reason = this.classifyIngestionError(error);
      this.metricsService.incrementMqttIngestion(kindLabel, 'rejected', reason);
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Failed to process MQTT message for ${this.truncateDeviceUid(parsedTopic.deviceUid)}: ${message}`,
      );
    }
  }

  // Validates telemetry payload, persists point, updates last seen, and caches live state.
  private async processTelemetryPayload(
    device: DeviceForIngestion,
    payload: unknown,
    deviceSecret: string,
  ): Promise<void> {
    const parsedPayload = telemetryPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new MqttValidationError(parsedPayload.error.message);
    }

    const telemetryPayload = parsedPayload.data;
    assertTimestampDrift(telemetryPayload.ts);
    this.assertSignatureValid(deviceSecret, telemetryPayload);
    await assertNonceNotReplayed(
      this.redisService,
      device.deviceUid,
      telemetryPayload.nonce,
    );

    const telemetryTimestamp = new Date(telemetryPayload.ts);
    await this.prismaService.$transaction([
      this.prismaService.telemetryPoint.create({
        data: {
          deviceId: device.id,
          ts: telemetryTimestamp,
          lat: telemetryPayload.lat,
          lng: telemetryPayload.lng,
          speedKph: telemetryPayload.speedKph,
          heading: telemetryPayload.heading,
          accelX: telemetryPayload.accel?.x,
          accelY: telemetryPayload.accel?.y,
          accelZ: telemetryPayload.accel?.z,
          batteryV: telemetryPayload.batteryV,
          ignition: telemetryPayload.ignition,
        },
      }),
      this.prismaService.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: telemetryTimestamp,
        },
      }),
    ]);

    if (device.bikeId) {
      const latestState = this.buildLiveBikeState(device, telemetryPayload);
      await this.liveStateService.setLatestBikeState(latestState);
    }

    await this.publishStreamTelemetry(device, telemetryPayload, telemetryTimestamp);

    await this.rulesEngineService.evaluateTelemetry(device, telemetryPayload);
    await this.tripBuilderService.processTelemetryForTrips(
      device,
      telemetryPayload,
    );
  }

  // Validates event payload, persists event row, and updates device last seen.
  private async processEventPayload(
    device: DeviceForIngestion,
    payload: unknown,
    deviceSecret: string,
  ): Promise<void> {
    const parsedPayload = eventPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new MqttValidationError(parsedPayload.error.message);
    }

    const eventPayload = parsedPayload.data;
    assertTimestampDrift(eventPayload.ts);
    this.assertSignatureValid(deviceSecret, eventPayload);
    await assertNonceNotReplayed(
      this.redisService,
      device.deviceUid,
      eventPayload.nonce,
    );

    const eventTimestamp = new Date(eventPayload.ts);
    await this.prismaService.$transaction([
      this.prismaService.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: eventTimestamp,
        },
      }),
    ]);

    await this.eventsService.createFleetEvent({
      fleetId: device.fleetId,
      bikeId: device.bikeId,
      deviceId: device.id,
      ts: eventTimestamp,
      type: eventPayload.type,
      severity: eventPayload.severity as EventSeverity,
      metaJson: eventPayload.meta as Prisma.InputJsonValue,
    });

    await this.publishStreamEvent(device, eventPayload, eventTimestamp);
  }

  // Validates command-ack payload and forwards acknowledgement to command service.
  private async processCommandAckPayload(
    device: DeviceForIngestion,
    payload: unknown,
    deviceSecret: string,
  ): Promise<void> {
    const parsedPayload = commandAckPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new MqttValidationError(parsedPayload.error.message);
    }

    const commandAckPayload = parsedPayload.data;
    assertTimestampDrift(commandAckPayload.ts);
    this.assertSignatureValid(deviceSecret, commandAckPayload);
    await assertNonceNotReplayed(
      this.redisService,
      device.deviceUid,
      commandAckPayload.nonce,
    );

    const ackTimestamp = new Date(commandAckPayload.ts);
    await this.prismaService.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: ackTimestamp,
      },
    });

    await this.commandsService.handleCommandAckFromDevice(
      device,
      commandAckPayload,
    );

    await this.publishStreamCommandAck(device, commandAckPayload, ackTimestamp);
  }

  // Writes telemetry payloads to the stream processor input.
  private async publishStreamTelemetry(
    device: DeviceForIngestion,
    telemetryPayload: TelemetryPayload,
    timestamp: Date,
  ): Promise<void> {
    if (!this.streamEnabled || !this.streamKey) {
      return;
    }

    try {
      await this.redisService.addToStream(
        this.streamKey,
        {
          kind: 'telemetry',
          deviceId: device.id,
          deviceUid: device.deviceUid,
          fleetId: device.fleetId,
          bikeId: device.bikeId ?? '',
          ts: timestamp.toISOString(),
          lat: telemetryPayload.lat.toString(),
          lng: telemetryPayload.lng.toString(),
          speedKph: telemetryPayload.speedKph.toString(),
          heading: telemetryPayload.heading?.toString() ?? '',
          accelX: telemetryPayload.accel?.x?.toString() ?? '',
          accelY: telemetryPayload.accel?.y?.toString() ?? '',
          accelZ: telemetryPayload.accel?.z?.toString() ?? '',
          batteryV: telemetryPayload.batteryV?.toString() ?? '',
          ignition: telemetryPayload.ignition ? 'true' : 'false',
        },
        this.streamMaxLen,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to publish telemetry stream for device=${device.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  // Writes event payloads to the stream processor input.
  private async publishStreamEvent(
    device: DeviceForIngestion,
    eventPayload: EventPayload,
    timestamp: Date,
  ): Promise<void> {
    if (!this.streamEnabled || !this.streamKey) {
      return;
    }

    try {
      await this.redisService.addToStream(
        this.streamKey,
        {
          kind: 'event',
          deviceId: device.id,
          deviceUid: device.deviceUid,
          fleetId: device.fleetId,
          bikeId: device.bikeId ?? '',
          ts: timestamp.toISOString(),
          type: eventPayload.type,
          severity: eventPayload.severity,
          metaJson: JSON.stringify(eventPayload.meta ?? {}),
        },
        this.streamMaxLen,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to publish event stream for device=${device.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  // Writes command acknowledgements to the stream processor input.
  private async publishStreamCommandAck(
    device: DeviceForIngestion,
    payload: CommandAckPayload,
    timestamp: Date,
  ): Promise<void> {
    if (!this.streamEnabled || !this.streamKey) {
      return;
    }

    try {
      await this.redisService.addToStream(
        this.streamKey,
        {
          kind: 'command_ack',
          deviceId: device.id,
          deviceUid: device.deviceUid,
          fleetId: device.fleetId,
          bikeId: device.bikeId ?? '',
          ts: timestamp.toISOString(),
          commandId: payload.commandId,
          status: payload.status,
          errorMessage: payload.errorMessage ?? '',
        },
        this.streamMaxLen,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to publish command_ack stream for device=${device.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  // Loads device security context by incoming MQTT device UID.
  private async loadDeviceByUid(
    deviceUid: string,
  ): Promise<DeviceForIngestion | null> {
    return this.prismaService.device.findUnique({
      where: { deviceUid },
      select: {
        id: true,
        fleetId: true,
        bikeId: true,
        deviceUid: true,
        status: true,
        secretHash: true,
        secretEncrypted: true,
      },
    });
  }

  // Decrypts device secret and cross-checks hash to detect tampering.
  private decryptAndValidateSecret(device: DeviceForIngestion): string {
    if (!device.secretEncrypted) {
      throw new MqttValidationError('Device has no encrypted secret');
    }

    const decryptedSecret = decryptDeviceSecret(
      device.secretEncrypted,
      this.deviceSecretMasterKey,
    );
    const computedHash = hashDeviceSecret(decryptedSecret);

    if (!this.timingSafeHexEqual(computedHash, device.secretHash)) {
      throw new MqttValidationError('Stored secret hash mismatch');
    }

    return decryptedSecret;
  }

  // Verifies that incoming payload signature matches expected HMAC.
  private assertSignatureValid(
    deviceSecret: string,
    payload: TelemetryPayload | EventPayload | CommandAckPayload,
  ): void {
    const payloadWithSig = payload as Record<string, unknown> & { sig: string };
    if (!verifyPayloadSignature(deviceSecret, payloadWithSig)) {
      throw new MqttValidationError('Invalid payload signature');
    }
  }

  // Builds live-state projection for fleet bike map rendering.
  private buildLiveBikeState(
    device: DeviceForIngestion,
    payload: TelemetryPayload,
  ): LiveBikeState {
    if (!device.bikeId) {
      throw new MqttValidationError(
        'Cannot build live state for unassigned bike',
      );
    }

    return {
      fleetId: device.fleetId,
      bikeId: device.bikeId,
      deviceId: device.id,
      deviceUid: device.deviceUid,
      ts: payload.ts,
      lat: payload.lat,
      lng: payload.lng,
      speedKph: payload.speedKph,
      heading: payload.heading,
      batteryV: payload.batteryV,
      ignition: payload.ignition,
    };
  }

  // Compares two hex hashes in constant time to prevent timing side channels.
  private timingSafeHexEqual(leftHex: string, rightHex: string): boolean {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  }

  // Produces a truncated device identifier safe for operational logs.
  private truncateDeviceUid(deviceUid: string): string {
    if (deviceUid.length <= 8) {
      return `${deviceUid.slice(0, 2)}***${deviceUid.slice(-2)}`;
    }

    return `${deviceUid.slice(0, 4)}...${deviceUid.slice(-4)}`;
  }

  // Maps ingestion errors to stable metric labels for observability dashboards.
  private classifyIngestionError(error: unknown): string {
    if (error instanceof SyntaxError) return 'parse_error';
    if (error instanceof MqttValidationError) return 'validation';
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('signature')) return 'signature';
      if (msg.includes('nonce') || msg.includes('replay')) return 'replay';
      if (msg.includes('timestamp') || msg.includes('drift')) return 'timestamp_drift';
      if (msg.includes('secret') || msg.includes('hash mismatch')) return 'crypto';
    }
    return 'unknown';
  }
}
