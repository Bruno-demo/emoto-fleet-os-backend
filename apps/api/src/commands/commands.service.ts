import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActionType,
  Bike,
  Device,
  DeviceCommand,
  DeviceCommandStatus,
  DeviceCommandType,
} from '@prisma/client';
import { timingSafeEqual, randomUUID } from 'crypto';
import mqtt, { MqttClient } from 'mqtt';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import {
  decryptDeviceSecret,
  hashDeviceSecret,
} from '../crypto/device-secret.crypto';
import {
  CommandAckPayload,
  CommandDownlinkPayloadWithoutSig,
  computePayloadSignature,
} from '../mqtt/mqtt-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsGateway } from '../events/events.gateway';
import { MetricsService } from '../metrics/metrics.service';
import { ModuleRef } from '@nestjs/core';
import { SinoTrackAdapterService } from '../ingestion/sinotrack-adapter.service';
import { FleetDeviceCommand } from './commands.types';

const LOCK_MIN_STATIONARY_MS = 15_000;
const MQTT_PUBLISH_TIMEOUT_MS = 10_000;

interface LiveStateSnapshot {
  ts: string;
  speedKph: number;
  ignition?: boolean;
}

@Injectable()
export class CommandsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommandsService.name);
  private readonly mqttUrl: string;
  private readonly deviceSecretMasterKey: string;
  private readonly commandTtlSeconds: number;
  private readonly mqttDisabled: boolean;
  private mqttClient: MqttClient | null = null;
  private mqttConnected = false;
  private readonly mqttUser?: string;
  private readonly mqttPassword?: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly moduleRef: ModuleRef,
  ) {
    this.mqttUrl = this.configService.getOrThrow<string>('MQTT_URL');
    this.deviceSecretMasterKey = this.configService.getOrThrow<string>(
      'DEVICE_SECRET_MASTER_KEY',
    );
    this.commandTtlSeconds = this.configService.get<number>(
      'COMMAND_TTL_SECONDS',
      45,
    );
    this.mqttDisabled = this.configService.get<boolean>('MQTT_DISABLED', false);
    this.mqttUser = this.configService.get<string>('MQTT_USER');
    this.mqttPassword = this.configService.get<string>('MQTT_PASSWORD');
  }

  onModuleInit(): void {
    if (this.mqttDisabled) {
      this.logger.log('MQTT is disabled — skipping client initialization');
      return;
    }

    const options: mqtt.IClientOptions = {
      reconnectPeriod: 5_000,
      connectTimeout: MQTT_PUBLISH_TIMEOUT_MS,
    };

    if (this.mqttUser) {
      options.username = this.mqttUser;
    }
    if (this.mqttPassword) {
      options.password = this.mqttPassword;
    }

    this.mqttClient = mqtt.connect(this.mqttUrl, options);

    this.mqttClient.on('connect', () => {
      this.mqttConnected = true;
      this.logger.log('MQTT client connected');
    });

    this.mqttClient.on('offline', () => {
      this.mqttConnected = false;
      this.logger.warn('MQTT client offline');
    });

    this.mqttClient.on('error', (err) => {
      this.logger.error(`MQTT client error: ${err.message}`);
    });

    // Connect asynchronously in the background to prevent server bootstrap crashes
    this.waitForConnect(this.mqttClient)
      .then(() => {
        this.logger.log('MQTT client connection verified');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `MQTT client failed to connect on startup (will auto-reconnect): ${message}`,
        );
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.mqttClient) {
      await new Promise<void>((resolve) =>
        this.mqttClient!.end(false, {}, () => resolve()),
      );
      this.mqttClient = null;
      this.mqttConnected = false;
      this.logger.log('MQTT client disconnected');
    }
  }

  // Creates and dispatches a LOCK command for a fleet bike.
  async requestLockForBike(
    bikeId: string,
    user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    return this.requestCommandForBike('LOCK', bikeId, user);
  }

  // Creates and dispatches an UNLOCK command for a fleet bike.
  async requestUnlockForBike(
    bikeId: string,
    user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    return this.requestCommandForBike('UNLOCK', bikeId, user);
  }

  // Creates and dispatches a LOCK command for any bike (HQ admin override).
  async requestLockForBikeHq(
    bikeId: string,
    user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    return this.requestCommandForBikeHq('LOCK', bikeId, user);
  }

  // Creates and dispatches an UNLOCK command for any bike (HQ admin override).
  async requestUnlockForBikeHq(
    bikeId: string,
    user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    return this.requestCommandForBikeHq('UNLOCK', bikeId, user);
  }

  // Applies command acknowledgement updates from MQTT uplink ack messages.
  async handleCommandAckFromDevice(
    device: Pick<Device, 'id' | 'fleetId' | 'deviceUid'>,
    payload: CommandAckPayload,
  ): Promise<void> {
    const command = await this.prismaService.deviceCommand.findUnique({
      where: { id: payload.commandId },
    });
    if (!command) {
      this.logger.warn(
        `Ignoring ack for unknown command ${payload.commandId} from ${this.truncateDeviceUid(device.deviceUid)}`,
      );
      return;
    }

    if (command.deviceId !== device.id || command.fleetId !== device.fleetId) {
      this.logger.warn(
        `Ignoring ack for mismatched command ${payload.commandId} from ${this.truncateDeviceUid(device.deviceUid)}`,
      );
      return;
    }

    if (this.isTerminalStatus(command.status)) {
      return;
    }

    const ackTimestamp = new Date(payload.ts);
    if (ackTimestamp.getTime() > command.expiresAt.getTime()) {
      await this.transitionStatus(command, 'EXPIRED', {
        ackedAt: ackTimestamp,
        errorMessage: 'Acknowledgement received after expiry',
      });
      return;
    }

    if (payload.status === 'ACKED') {
      await this.transitionStatus(command, 'ACKED', {
        ackedAt: ackTimestamp,
        errorMessage: null,
      });
      return;
    }

    await this.transitionStatus(command, 'FAILED', {
      ackedAt: ackTimestamp,
      errorMessage: payload.errorMessage ?? 'Device reported failure',
    });
  }

  // Creates pending command row, publishes MQTT downlink, and updates status.
  private async requestCommandForBike(
    type: DeviceCommandType,
    bikeId: string,
    user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    const bike = await this.loadBikeForFleetOrThrow(bikeId, user);
    const device = await this.loadActiveBikeDeviceOrThrow(
      bike.id,
      user.fleetId,
    );
    const latestState = await this.loadLatestState(user.fleetId, bike.id);

    if (type === 'LOCK') {
      await this.assertSafeToLock(device.id, latestState);
    }

    const command = await this.prismaService.deviceCommand.create({
      data: {
        fleetId: user.fleetId,
        deviceId: device.id,
        bikeId: bike.id,
        type,
        status: 'PENDING',
        requestedByUserId: user.id,
        payloadJson: {},
        nonce: randomUUID(),
        expiresAt: new Date(Date.now() + this.commandTtlSeconds * 1000),
      },
    });

    await this.auditService.createAuditLog({
      fleetId: command.fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.DEVICE_COMMAND_REQUESTED,
      targetType: 'DEVICE_COMMAND',
      targetId: command.id,
      metaJson: {
        commandType: command.type,
        status: command.status,
        bikeId: command.bikeId,
        deviceId: command.deviceId,
      },
    });

    // 1. Direct TCP Dispatch for connected SinoTrack / GT06 devices
    let tcpDispatched = false;
    try {
      const sinoTrackAdapter = this.moduleRef.get(SinoTrackAdapterService, {
        strict: false,
      });
      if (sinoTrackAdapter) {
        tcpDispatched = sinoTrackAdapter.dispatchDirectCommand(
          device.deviceUid,
          type,
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`SinoTrack TCP direct dispatch skipped: ${errMsg}`);
    }

    // Store pending command in Redis for SinoTrack TCP auto-flush when tracker connects
    if (!tcpDispatched) {
      try {
        await this.redisService.set(
          `sinotrack:pending_cmd:${device.deviceUid}`,
          JSON.stringify({
            commandId: command.id,
            type,
            deviceUid: device.deviceUid,
            imei: device.imei,
          }),
          600,
        );
        this.logger.log(
          `Queued pending command in Redis key sinotrack:pending_cmd:${device.deviceUid} for SinoTrack TCP auto-flush`,
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to queue pending command in Redis: ${errMsg}`);
      }
    }

    // 2. MQTT Publish
    const unsignedPayload = this.buildDownlinkPayload(command);
    const topic = `v1/devices/${device.deviceUid}/command`;

    try {
      const deviceSecret = this.decryptAndValidateSecret(device);
      const sig = computePayloadSignature(deviceSecret, unsignedPayload);
      const payload = {
        ...unsignedPayload,
        sig,
      };

      await this.publishMqtt(topic, payload);

      const nextStatus = tcpDispatched ? 'ACKED' : 'SENT';
      const sentCommand = await this.transitionStatus(
        command,
        nextStatus,
        {
          sentAt: new Date(),
          ackedAt: tcpDispatched ? new Date() : null,
          errorMessage: null,
        },
        user.id,
      );
      return this.toFleetDeviceCommand(sentCommand);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `MQTT publish unavailable for deviceUid=${device.deviceUid}: ${message}. Command queued via TCP/Redis fallback.`,
      );
      const finalStatus = tcpDispatched ? 'ACKED' : 'SENT';
      const resultCommand = await this.transitionStatus(
        command,
        finalStatus,
        {
          sentAt: new Date(),
          ackedAt: tcpDispatched ? new Date() : null,
          errorMessage: tcpDispatched ? null : `MQTT unavailable: ${message}`,
        },
        user.id,
      );
      return this.toFleetDeviceCommand(resultCommand);
    }
  }

  // Creates pending command row for HQ admin, bypassing fleet ownership.
  private async requestCommandForBikeHq(
    type: DeviceCommandType,
    bikeId: string,
    user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    const bike = await this.loadBikeOrThrow(bikeId);
    const device = await this.loadActiveBikeDeviceOrThrow(
      bike.id,
      bike.fleetId,
    );
    const latestState = await this.loadLatestState(bike.fleetId, bike.id);

    if (type === 'LOCK') {
      await this.assertSafeToLock(device.id, latestState);
    }

    const command = await this.prismaService.deviceCommand.create({
      data: {
        fleetId: bike.fleetId,
        deviceId: device.id,
        bikeId: bike.id,
        type,
        status: 'PENDING',
        requestedByUserId: user.id,
        payloadJson: {},
        nonce: randomUUID(),
        expiresAt: new Date(Date.now() + this.commandTtlSeconds * 1000),
      },
    });

    await this.auditService.createAuditLog({
      fleetId: command.fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.DEVICE_COMMAND_REQUESTED,
      targetType: 'DEVICE_COMMAND',
      targetId: command.id,
      metaJson: {
        commandType: command.type,
        status: command.status,
        bikeId: command.bikeId,
        deviceId: command.deviceId,
        hqOverride: true,
      },
    });

    // 1. Direct TCP Dispatch for connected SinoTrack / GT06 devices
    let tcpDispatched = false;
    try {
      const sinoTrackAdapter = this.moduleRef.get(SinoTrackAdapterService, {
        strict: false,
      });
      if (sinoTrackAdapter) {
        tcpDispatched = sinoTrackAdapter.dispatchDirectCommand(
          device.deviceUid,
          type,
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`SinoTrack TCP direct dispatch skipped: ${errMsg}`);
    }

    // Store pending command in Redis for SinoTrack TCP auto-flush when tracker connects
    if (!tcpDispatched) {
      try {
        await this.redisService.set(
          `sinotrack:pending_cmd:${device.deviceUid}`,
          JSON.stringify({
            commandId: command.id,
            type,
            deviceUid: device.deviceUid,
            imei: device.imei,
          }),
          600,
        );
        this.logger.log(
          `Queued pending command in Redis key sinotrack:pending_cmd:${device.deviceUid} for SinoTrack TCP auto-flush`,
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to queue pending command in Redis: ${errMsg}`);
      }
    }

    // 2. MQTT Publish
    const unsignedPayload = this.buildDownlinkPayload(command);
    const topic = `v1/devices/${device.deviceUid}/command`;

    try {
      const deviceSecret = this.decryptAndValidateSecret(device);
      const sig = computePayloadSignature(deviceSecret, unsignedPayload);
      const payload = {
        ...unsignedPayload,
        sig,
      };

      await this.publishMqtt(topic, payload);

      const nextStatus = tcpDispatched ? 'ACKED' : 'SENT';
      const sentCommand = await this.transitionStatus(
        command,
        nextStatus,
        {
          sentAt: new Date(),
          ackedAt: tcpDispatched ? new Date() : null,
          errorMessage: null,
        },
        user.id,
      );
      return this.toFleetDeviceCommand(sentCommand);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `MQTT publish unavailable for deviceUid=${device.deviceUid}: ${message}. Command queued via TCP/Redis fallback.`,
      );
      const finalStatus = tcpDispatched ? 'ACKED' : 'SENT';
      const resultCommand = await this.transitionStatus(
        command,
        finalStatus,
        {
          sentAt: new Date(),
          ackedAt: tcpDispatched ? new Date() : null,
          errorMessage: tcpDispatched ? null : `MQTT unavailable: ${message}`,
        },
        user.id,
      );
      return this.toFleetDeviceCommand(resultCommand);
    }
  }

  // Updates command status and records audit + websocket notifications.
  private async transitionStatus(
    command: DeviceCommand,
    nextStatus: DeviceCommandStatus,
    update: {
      sentAt?: Date | null;
      ackedAt?: Date | null;
      errorMessage?: string | null;
    },
    actorUserId?: string,
  ): Promise<DeviceCommand> {
    const updatedCommand = await this.prismaService.deviceCommand.update({
      where: { id: command.id },
      data: {
        status: nextStatus,
        sentAt: update.sentAt,
        ackedAt: update.ackedAt,
        errorMessage: update.errorMessage,
      },
    });

    await this.auditService.createAuditLog({
      fleetId: updatedCommand.fleetId,
      actorUserId,
      actionType: AuditActionType.DEVICE_COMMAND_STATUS_CHANGED,
      targetType: 'DEVICE_COMMAND',
      targetId: updatedCommand.id,
      metaJson: {
        previousStatus: command.status,
        status: updatedCommand.status,
        errorMessage: updatedCommand.errorMessage,
      },
    });

    this.metricsService.incrementCommandStatus(
      updatedCommand.status,
      updatedCommand.type,
    );

    this.eventsGateway.emitCommandStatus(updatedCommand.fleetId, {
      commandId: updatedCommand.id,
      status: updatedCommand.status,
      ts: new Date().toISOString(),
      bikeId: updatedCommand.bikeId ?? undefined,
      deviceId: updatedCommand.deviceId,
      action: updatedCommand.type,
      message: updatedCommand.errorMessage ?? undefined,
    });

    return updatedCommand;
  }

  // Loads latest live state if available (returns null if parked / offline).
  private async loadLatestState(
    fleetId: string,
    bikeId: string,
  ): Promise<LiveStateSnapshot | null> {
    try {
      const rawState = await this.redisService.get(
        this.liveStateKey(fleetId, bikeId),
      );
      if (!rawState) {
        return null;
      }

      const parsedState = JSON.parse(rawState) as {
        ts?: unknown;
        speedKph?: unknown;
        ignition?: unknown;
      };

      if (
        typeof parsedState.ts !== 'string' ||
        typeof parsedState.speedKph !== 'number' ||
        Number.isNaN(Date.parse(parsedState.ts))
      ) {
        return null;
      }

      return {
        ts: parsedState.ts,
        speedKph: parsedState.speedKph,
        ignition:
          typeof parsedState.ignition === 'boolean'
            ? parsedState.ignition
            : undefined,
      };
    } catch {
      return null;
    }
  }

  // Enforces lock safety constraints on speed and ignition.
  private async assertSafeToLock(
    deviceId: string,
    state: LiveStateSnapshot | null,
  ): Promise<void> {
    if (!state) {
      return; // Safe to lock parked / offline bike with no recent live telemetry
    }

    if (state.ignition === true) {
      throw new BadRequestException('Cannot lock while ignition is ON');
    }

    if (Math.abs(state.speedKph) > 0.5) {
      throw new BadRequestException('Cannot lock while bike is moving');
    }

    // Query database to find when the bike was last moving
    const lastMovingPoint = await this.prismaService.telemetryPoint.findFirst({
      where: {
        deviceId,
        speedKph: { gt: 0.01 },
      },
      orderBy: {
        ts: 'desc',
      },
    });

    const stationaryMs = lastMovingPoint
      ? Date.now() - lastMovingPoint.ts.getTime()
      : Infinity; // fallback if it was never moving

    if (stationaryMs < LOCK_MIN_STATIONARY_MS) {
      throw new BadRequestException(
        `Bike must be speed 0 for at least 15 seconds before lock (currently stopped for ${Math.round(stationaryMs / 1000)}s)`,
      );
    }
  }

  // Loads a bike and enforces fleet ownership access controls.
  private async loadBikeForFleetOrThrow(
    bikeId: string,
    user: AuthenticatedUser,
  ): Promise<Bike> {
    const bike = await this.prismaService.bike.findUnique({
      where: { id: bikeId },
    });
    if (!bike) {
      throw new NotFoundException('Bike not found');
    }

    if (bike.fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }

    return bike;
  }

  // Loads a bike without fleet ownership constraints (for HQ admin).
  private async loadBikeOrThrow(bikeId: string): Promise<Bike> {
    const bike = await this.prismaService.bike.findUnique({
      where: { id: bikeId },
    });
    if (!bike) {
      throw new NotFoundException('Bike not found');
    }
    return bike;
  }

  // Selects an active device assigned to a bike for command dispatch.
  private async loadActiveBikeDeviceOrThrow(
    bikeId: string,
    fleetId: string,
  ): Promise<
    Pick<
      Device,
      | 'id'
      | 'fleetId'
      | 'bikeId'
      | 'deviceUid'
      | 'secretHash'
      | 'secretEncrypted'
    >
  > {
    const device = await this.prismaService.device.findFirst({
      where: {
        bikeId,
        fleetId,
        status: 'ACTIVE',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        fleetId: true,
        bikeId: true,
        deviceUid: true,
        secretHash: true,
        secretEncrypted: true,
      },
    });

    if (!device) {
      throw new BadRequestException(
        'No active device is assigned to this bike',
      );
    }

    return device;
  }

  // Decrypts persisted secret and verifies integrity via stored hash.
  private decryptAndValidateSecret(
    device: Pick<Device, 'secretEncrypted' | 'secretHash'>,
  ): string {
    if (!device.secretEncrypted) {
      throw new Error('Device has no encrypted secret');
    }

    const decrypted = decryptDeviceSecret(
      device.secretEncrypted,
      this.deviceSecretMasterKey,
    );
    const computedHash = hashDeviceSecret(decrypted);
    if (!this.timingSafeHexEqual(computedHash, device.secretHash)) {
      throw new Error('Device secret hash mismatch');
    }

    return decrypted;
  }

  // Publishes signed downlink payload to broker with timeout and qos1.
  private async publishMqtt(
    topic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (this.mqttDisabled) {
      this.logger.log(
        `Skipping MQTT publish for ${topic} because MQTT is disabled`,
      );
      return;
    }

    if (!this.mqttClient || !this.mqttConnected) {
      throw new Error('MQTT client is not connected');
    }

    await Promise.race([
      new Promise<void>((resolve, reject) => {
        this.mqttClient!.publish(
          topic,
          JSON.stringify(payload),
          { qos: 1 },
          (error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          },
        );
      }),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error('MQTT publish timeout')),
          MQTT_PUBLISH_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  // Waits for MQTT connect event and rejects on timeout or client errors.
  private async waitForConnect(client: MqttClient): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out connecting to MQTT broker'));
      }, MQTT_PUBLISH_TIMEOUT_MS);

      const onConnect = (): void => {
        cleanup();
        resolve();
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const cleanup = (): void => {
        clearTimeout(timeout);
        client.off('connect', onConnect);
        client.off('error', onError);
      };

      client.once('connect', onConnect);
      client.once('error', onError);
    });
  }

  // Creates canonical downlink payload before HMAC signature is added.
  private buildDownlinkPayload(
    command: DeviceCommand,
  ): CommandDownlinkPayloadWithoutSig {
    return {
      commandId: command.id,
      type: command.type,
      ts: new Date().toISOString(),
      nonce: command.nonce,
      expiresAt: command.expiresAt.toISOString(),
      payload: {},
    };
  }

  // Converts Prisma command entity to API-safe response shape.
  private toFleetDeviceCommand(command: DeviceCommand): FleetDeviceCommand {
    return {
      id: command.id,
      fleetId: command.fleetId,
      deviceId: command.deviceId,
      bikeId: command.bikeId,
      type: command.type,
      status: command.status,
      requestedByUserId: command.requestedByUserId,
      requestedAt: command.requestedAt,
      sentAt: command.sentAt,
      ackedAt: command.ackedAt,
      payloadJson: command.payloadJson,
      errorMessage: command.errorMessage,
      nonce: command.nonce,
      expiresAt: command.expiresAt,
      createdAt: command.createdAt,
      updatedAt: command.updatedAt,
    };
  }

  // Builds deterministic redis key used by latest-state cache.
  private liveStateKey(fleetId: string, bikeId: string): string {
    return `live:fleet:${fleetId}:bike:${bikeId}`;
  }

  // Determines whether command status can no longer transition.
  private isTerminalStatus(status: DeviceCommandStatus): boolean {
    return ['ACKED', 'FAILED', 'EXPIRED'].includes(status);
  }

  // Compares hex strings in constant time to avoid timing attacks.
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
}
