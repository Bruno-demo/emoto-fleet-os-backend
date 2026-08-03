import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus } from '@prisma/client';
import * as net from 'net';
import * as mqtt from 'mqtt';
import { timingSafeEqual } from 'crypto';
import {
  TelemetryPayload,
  computePayloadSignature,
  commandDownlinkPayloadSchema,
  verifyPayloadSignature,
  assertTimestampDrift,
  assertNonceNotReplayed,
} from '../mqtt/mqtt-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';
import { EventsGateway } from '../events/events.gateway';
import { LiveBikeState } from './ingestion.types';
import { LiveStateService } from './live-state.service';
import { RulesEngineService } from './rules-engine.service';
import { TripBuilderService } from './trip-builder.service';
import {
  decryptDeviceSecret,
  hashDeviceSecret,
} from '../crypto/device-secret.crypto';

interface DeviceForIngestion {
  id: string;
  fleetId: string;
  bikeId: string | null;
  deviceUid: string;
  status: DeviceStatus;
  secretHash: string;
  secretEncrypted: string | null;
}

interface SinoTrackSocket extends net.Socket {
  deviceUid?: string;
}

@Injectable()
export class SinoTrackAdapterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SinoTrackAdapterService.name);
  private tcpServer: net.Server | null = null;
  private readonly enabled: boolean;
  private readonly port: number;
  private readonly streamKey: string | null;
  private readonly streamMaxLen: number;
  private readonly streamEnabled: boolean;
  private readonly activeSockets = new Set<net.Socket>();
  private readonly activeConnections = new Map<
    string,
    { socket: net.Socket; imei: string }
  >();
  private mqttClient: mqtt.MqttClient | null = null;
  private readonly deviceSecretMasterKey: string;
  private readonly devicePassword: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly liveStateService: LiveStateService,
    private readonly rulesEngineService: RulesEngineService,
    private readonly tripBuilderService: TripBuilderService,
    private readonly metricsService: MetricsService,
    private readonly eventsGateway: EventsGateway,
  ) {
    this.enabled = this.configService.get<boolean>('SINOTRACK_ENABLED', true);
    this.port = this.configService.get<number>('SINOTRACK_PORT', 5013);
    this.streamKey =
      this.configService.get<string>('STREAM_KEY', 'telemetry:stream') || null;
    this.streamMaxLen = this.configService.get<number>('STREAM_MAX_LEN', 10000);
    this.streamEnabled = this.configService.get<boolean>(
      'STREAM_ENABLED',
      true,
    );
    this.deviceSecretMasterKey = this.configService.getOrThrow<string>(
      'DEVICE_SECRET_MASTER_KEY',
    );
    this.devicePassword = this.configService.get<string>(
      'SINOTRACK_DEVICE_PASSWORD',
      '0000',
    );
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(
        'SinoTrack ST-901 TCP Ingestion Adapter is disabled by configuration',
      );
      return;
    }

    this.tcpServer = net.createServer((socket) => {
      this.handleSocketConnection(socket);
    });

    // Protect against host file descriptor exhaustion
    this.tcpServer.maxConnections = 5000;

    this.tcpServer.on('error', (err) => {
      this.logger.error(
        `SinoTrack TCP Server error: ${err.message}`,
        err.stack,
      );
    });

    this.tcpServer.listen(this.port, '0.0.0.0', () => {
      this.logger.log(
        `SinoTrack ST-901 TCP Ingestion Adapter listening on 0.0.0.0:${this.port}`,
      );
    });

    // Initialize MQTT command subscriber
    const mqttUrl = this.configService.getOrThrow<string>('MQTT_URL');
    const mqttUser = this.configService.get<string>('MQTT_USER');
    const mqttPassword = this.configService.get<string>('MQTT_PASSWORD');
    const mqttDisabled = this.configService.get<boolean>(
      'MQTT_DISABLED',
      false,
    );

    if (!mqttDisabled) {
      const options: mqtt.IClientOptions = {
        reconnectPeriod: 3_000,
        connectTimeout: 10_000,
      };
      if (mqttUser) {
        options.username = mqttUser;
      }
      if (mqttPassword) {
        options.password = mqttPassword;
      }

      this.mqttClient = mqtt.connect(mqttUrl, options);

      this.mqttClient.on('connect', () => {
        this.mqttClient?.subscribe(
          'v1/devices/+/command',
          { qos: 1 },
          (err) => {
            if (err) {
              this.logger.error(
                `SinoTrack MQTT command subscription failed: ${err.message}`,
              );
            } else {
              this.logger.log(
                'SinoTrack MQTT adapter subscribed to command topics',
              );
            }
          },
        );
      });

      this.mqttClient.on('message', (topic: string, payload: Buffer) => {
        void this.handleMqttCommand(topic, payload.toString('utf8'));
      });

      this.mqttClient.on('error', (err) => {
        this.logger.warn(`SinoTrack MQTT client error: ${err.message}`);
      });
    }
  }

  onModuleDestroy(): void {
    this.logger.log('Shutting down SinoTrack TCP Server...');
    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();
    this.activeConnections.clear();

    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }

    if (this.tcpServer) {
      this.tcpServer.close(() => {
        this.logger.log('SinoTrack TCP Server shut down successfully');
      });
      this.tcpServer = null;
    }
  }

  private handleSocketConnection(socket: net.Socket): void {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    this.logger.debug(`New SinoTrack TCP connection from ${remoteAddress}`);
    this.activeSockets.add(socket);

    // Secure timeout: destroy connection if idle for 2 minutes
    socket.setTimeout(120000);
    socket.on('timeout', () => {
      this.logger.debug(
        `SinoTrack TCP socket idle timeout for ${remoteAddress}. Destroying.`,
      );
      socket.destroy();
    });

    let buffer = '';
    let processingQueue = Promise.resolve();

    socket.on('data', (chunk) => {
      // Memory protection: Cap byte accumulator size at 2048 bytes to defend against heap overflow
      if (buffer.length + chunk.length > 2048) {
        this.logger.warn(
          `SinoTrack socket ${remoteAddress} exceeded maximum GPRS accumulator size (2048 bytes). Destroying socket.`,
        );
        socket.destroy();
        return;
      }

      buffer += chunk.toString('ascii');

      // Messages are terminated by '#'
      let boundaryIndex: number;
      while ((boundaryIndex = buffer.indexOf('#')) !== -1) {
        const rawPacket = buffer.substring(0, boundaryIndex + 1);
        buffer = buffer.substring(boundaryIndex + 1);

        // Chain the processing on the promise queue to ensure strict sequential order
        processingQueue = processingQueue.then(async () => {
          try {
            await this.processRawPacket(rawPacket, socket);
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : 'unknown error';
            this.logger.error(
              `Error processing SinoTrack GPRS packet: ${message}`,
            );
          }
        });
      }
    });

    socket.on('error', (err) => {
      this.logger.warn(
        `SinoTrack connection error for ${remoteAddress}: ${err.message}`,
      );
    });

    socket.on('close', () => {
      this.logger.debug(`SinoTrack TCP connection closed for ${remoteAddress}`);
      this.activeSockets.delete(socket);
      const dUid = (socket as SinoTrackSocket).deviceUid;
      if (dUid) {
        this.activeConnections.delete(dUid);
      }
    });
  }

  private async processRawPacket(
    rawPacket: string,
    socket: net.Socket,
  ): Promise<void> {
    const trimmed = rawPacket.trim();

    // Log the raw GPRS packet into Redis list for diagnostics
    try {
      const logEntry = JSON.stringify({
        ts: new Date().toISOString(),
        packet: trimmed,
        remoteAddress: `${socket.remoteAddress}:${socket.remotePort}`,
      });
      await this.redisService.lpushAndTrim(
        'sinotrack:raw_packets',
        logEntry,
        20,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to log raw packet to Redis: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    if (!trimmed.startsWith('*HQ')) {
      this.logger.warn(
        `Ignoring malformed packet (invalid header): "${trimmed}"`,
      );
      return;
    }

    // Strip trailing '#'
    const content = trimmed.endsWith('#') ? trimmed.slice(0, -1) : trimmed;
    const parts = content.split(',');

    if (parts.length < 3) {
      this.logger.warn(
        `Ignoring malformed packet (too few parts): "${trimmed}"`,
      );
      return;
    }

    const imei = parts[1];
    const command = parts[2];

    try {
      const device = await this.loadDeviceByImei(imei);
      if (!device || device.status !== 'ACTIVE') {
        this.metricsService.incrementMqttIngestion(
          'sinotrack',
          'rejected',
          'unknown_device',
        );
        this.logger.warn(
          `Ignoring packet from unknown/inactive device with IMEI: ${imei}`,
        );
        return;
      }

      // Bind socket to deviceUid and imei for dual connection mapping
      this.activeConnections.set(device.deviceUid, { socket, imei });
      if (imei) {
        this.activeConnections.set(imei, { socket, imei });
      }
      (socket as SinoTrackSocket).deviceUid = device.deviceUid;

      // Check Redis for pending remote commands queued for this device and auto-flush over TCP
      try {
        const pendingKey = `sinotrack:pending_cmd:${device.deviceUid}`;
        const pendingCmdJson = await this.redisService.get(pendingKey);
        if (pendingCmdJson) {
          const pendingCmd = JSON.parse(pendingCmdJson) as {
            commandId: string;
            type: 'LOCK' | 'UNLOCK';
            imei: string;
          };
          const hhmmss = new Date()
            .toISOString()
            .substring(11, 19)
            .replace(/:/g, '');
          const s20Cmd =
            pendingCmd.type === 'LOCK'
              ? `S20,${hhmmss},1,1`
              : `S20,${hhmmss},0,1`;
          const s20Packet = `*HQ,${imei},${s20Cmd}#`;
          const sinotrackCmd =
            pendingCmd.type === 'LOCK'
              ? `940${this.devicePassword}`
              : `941${this.devicePassword}`;
          const hqPacket = `*HQ,${imei},${sinotrackCmd}#`;
          const combinedPackets = `${s20Packet}\r\n${hqPacket}\r\n`;

          socket.write(combinedPackets, 'ascii', () => {
            this.logger.log(
              `Auto-flushed queued ${pendingCmd.type} command to SinoTrack TCP socket imei=${imei}: ${s20Packet} & ${hqPacket}`,
            );
          });

          await this.redisService.del(pendingKey);

          await this.prismaService.deviceCommand.update({
            where: { id: pendingCmd.commandId },
            data: {
              status: 'ACKED',
              ackedAt: new Date(),
            },
          });
        }
      } catch (flushErr: unknown) {
        const msg =
          flushErr instanceof Error ? flushErr.message : String(flushErr);
        this.logger.warn(
          `Failed to auto-flush pending SinoTrack TCP command: ${msg}`,
        );
      }

      if (command === 'V1' || command === 'V8') {
        socket.write(`*HQ,${imei},V1#\r\n`, 'ascii');
        await this.processTelemetryPacket(device, parts);
      } else if (
        command === 'S20' ||
        command.startsWith('94') ||
        command === '555' ||
        command === '666' ||
        command === 'R12'
      ) {
        this.logger.log(
          `Received command ACK response from SinoTrack tracker imei=${imei}: ${trimmed}`,
        );
        const latestCmd = await this.prismaService.deviceCommand.findFirst({
          where: {
            deviceId: device.id,
            status: { in: ['PENDING', 'SENT'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (latestCmd) {
          await this.prismaService.deviceCommand.update({
            where: { id: latestCmd.id },
            data: { status: 'ACKED', ackedAt: new Date() },
          });
          this.eventsGateway.emitCommandStatus(device.fleetId, {
            commandId: latestCmd.id,
            status: 'ACKED',
            ts: new Date().toISOString(),
            bikeId: device.bikeId ?? undefined,
            deviceId: device.id,
            action: latestCmd.type,
          });
        }
      } else {
        socket.write(`*HQ,${imei},LINK#\r\n`, 'ascii');
        await this.processHeartbeatPacket(device);
      }
    } catch (error: unknown) {
      this.metricsService.incrementMqttIngestion(
        'sinotrack',
        'rejected',
        'parse_error',
      );
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed to process SinoTrack packet for IMEI=${imei}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async processTelemetryPacket(
    device: DeviceForIngestion,
    parts: string[],
  ): Promise<void> {
    if (parts.length < 13) {
      throw new Error(
        `Location packet V1 has fewer parts than expected (length: ${parts.length})`,
      );
    }

    const timeStr = parts[3]; // hhmmss
    const validity = parts[4]; // A/V
    const latStr = parts[5]; // ddmm.mmmm
    const latHem = parts[6]; // N/S
    const lngStr = parts[7]; // dddmm.mmmm
    const lngHem = parts[8]; // E/W
    const speedStr = parts[9]; // knots
    const headingStr = parts[10]; // degrees
    const dateStr = parts[11]; // ddmmyy
    const statusHex = parts[12]; // 8-character hex status

    // If validity is Void, we don't save telemetry in PG DB or evaluate rules/trips to prevent database pollution.
    // However, we parse the last-known coordinate and write it to Redis so it stays visible on the map.
    if (validity !== 'A') {
      this.logger.debug(
        `Device IMEI=${parts[1]} reported invalid GPS fix (V). Caching position to Redis and updating keep-alive.`,
      );
      try {
        const { lat, lng } = this.parseCoordinates(
          latStr,
          latHem,
          lngStr,
          lngHem,
        );
        const speedKnots = parseFloat(speedStr);
        const speedKph = isNaN(speedKnots) ? 0 : speedKnots * 1.852;
        const heading = parseFloat(headingStr);
        const ts = this.parseDateTime(dateStr, timeStr);

        // Update last seen in DB with current receipt time
        await this.prismaService.device.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date() },
        });

        // Cache state in Redis so the bike stays visible on the map
        if (device.bikeId && lat !== 0 && lng !== 0) {
          const latestState: LiveBikeState = {
            fleetId: device.fleetId,
            bikeId: device.bikeId,
            deviceId: device.id,
            deviceUid: device.deviceUid,
            ts: ts.toISOString(),
            lat,
            lng,
            speedKph,
            heading: isNaN(heading) ? undefined : heading,
            ignition: false, // Assume ignition off or unknown in void state
          };
          await this.liveStateService.setLatestBikeState(latestState);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown';
        this.logger.warn(
          `Failed to process void GPS telemetry for caching: ${msg}`,
        );
        await this.processHeartbeatPacket(device);
      }
      return;
    }

    // Convert coordinates DDMM.MMMM to Decimal Degrees
    const { lat, lng } = this.parseCoordinates(latStr, latHem, lngStr, lngHem);

    // Convert Knots to Km/h
    const speedKnots = parseFloat(speedStr);
    if (isNaN(speedKnots)) {
      throw new Error(`Parsed speed is NaN: ${speedStr}`);
    }
    const speedKph = speedKnots * 1.852;

    // Parse Heading
    const heading = parseFloat(headingStr);

    // Parse UTC Date and Time
    const ts = this.parseDateTime(dateStr, timeStr);

    // Extract battery voltage and percentage from statusHex and extended packet parts
    const { batteryV, batteryPct } = this.extractBatteryInfo(statusHex, parts);

    // Parse Ignition status (ACC) and Main Power Cut status from status hex or alarm command
    let ignition = true;
    let mainPowerCut = false;

    const command = parts[2];
    if (
      command === 'EXPOWER' ||
      command === 'POWERCUT' ||
      command === 'POWEROFF'
    ) {
      mainPowerCut = true;
    } else if (statusHex && statusHex.length >= 6) {
      const alarmByteHex = statusHex.substring(2, 4);
      const alarmByte = parseInt(alarmByteHex, 16);
      const thirdByteHex = statusHex.substring(4, 6);
      const thirdByte = parseInt(thirdByteHex, 16);

      if (!isNaN(thirdByte)) {
        ignition = (thirdByte & 0x04) !== 0;
      }

      if (!isNaN(alarmByte) && (alarmByte === 0x02 || alarmByte === 0x0a)) {
        mainPowerCut = true;
      } else if (!isNaN(thirdByte) && (thirdByte & 0x01) === 0) {
        // External main power disconnect bit (bit 0 = 0 means main power cut)
        mainPowerCut = true;
      }
    }

    // Also check battery voltage: if batteryV <= 6.0V, tracker is running on its 3.7V internal backup battery!
    // This happens when the e-bike 72V/60V/48V main battery is unplugged/swapped.
    if (batteryV !== undefined && batteryV > 0 && batteryV <= 6.0) {
      mainPowerCut = true;
    }

    // Apply stationary GPS drift filtering and speed clamping
    const filtered = await this.liveStateService.filterStationaryDrift(
      device.fleetId,
      device.bikeId,
      {
        lat,
        lng,
        speedKph,
        ignition,
      },
    );

    // Construct telemetry payload for internal components
    const telemetryPayload: TelemetryPayload = {
      ts: ts.toISOString(),
      lat: filtered.lat,
      lng: filtered.lng,
      speedKph: filtered.speedKph,
      heading: isNaN(heading) ? undefined : heading,
      batteryV,
      batteryPct,
      ignition,
      mainPowerCut,
      nonce: `sinotrack-${device.id}-${ts.getTime()}`,
      sig: 'bypassed-sinotrack-secure-local-adapter',
    };

    await this.prismaService.$transaction([
      this.prismaService.telemetryPoint.upsert({
        where: {
          deviceId_ts: {
            deviceId: device.id,
            ts,
          },
        },
        create: {
          deviceId: device.id,
          ts,
          lat: filtered.lat,
          lng: filtered.lng,
          speedKph: filtered.speedKph,
          heading: isNaN(heading) ? null : heading,
          batteryV: batteryV !== undefined ? batteryV : null,
          batteryPct: batteryPct !== undefined ? batteryPct : null,
          ignition,
        },
        update: {
          lat: filtered.lat,
          lng: filtered.lng,
          speedKph: filtered.speedKph,
          heading: isNaN(heading) ? null : heading,
          batteryV: batteryV !== undefined ? batteryV : null,
          batteryPct: batteryPct !== undefined ? batteryPct : null,
          ignition,
        },
      }),
      this.prismaService.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
        },
      }),
    ]);

    // Live state caching for UI rendering
    if (device.bikeId) {
      const latestState: LiveBikeState = {
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        deviceId: device.id,
        deviceUid: device.deviceUid,
        ts: telemetryPayload.ts,
        lat: filtered.lat,
        lng: filtered.lng,
        speedKph: filtered.speedKph,
        heading: telemetryPayload.heading,
        batteryV,
        batteryPct,
        ignition,
        mainPowerCut,
      };
      await this.liveStateService.setLatestBikeState(latestState);
    }

    // Publish to stream-processor input pipeline
    await this.publishStreamTelemetry(device, telemetryPayload, ts);

    // Evaluate in safety/security rules engine
    await this.rulesEngineService.evaluateTelemetry(
      {
        id: device.id,
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        deviceUid: device.deviceUid,
      },
      telemetryPayload,
    );

    // Process trip logic
    await this.tripBuilderService.processTelemetryForTrips(
      {
        id: device.id,
        fleetId: device.fleetId,
        bikeId: device.bikeId,
        deviceUid: device.deviceUid,
      },
      telemetryPayload,
    );

    this.metricsService.incrementMqttIngestion('sinotrack', 'accepted');
  }

  private async processHeartbeatPacket(
    device: DeviceForIngestion,
  ): Promise<void> {
    const timestamp = new Date();
    await this.prismaService.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: timestamp,
      },
    });

    if (device.bikeId) {
      try {
        const cached = await this.liveStateService.getBikeState(
          device.fleetId,
          device.bikeId,
        );
        if (cached) {
          cached.ts = timestamp.toISOString();
          await this.liveStateService.setLatestBikeState(cached);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.warn(
          `Failed to update cached heartbeat timestamp: ${message}`,
        );
      }
    }

    this.metricsService.incrementMqttIngestion('sinotrack', 'accepted');
  }

  private parseCoordinates(
    latStr: string,
    latHem: string,
    lngStr: string,
    lngHem: string,
  ): { lat: number; lng: number } {
    if (!latStr || !lngStr) {
      throw new Error('Coordinates strings are empty');
    }

    // Parse Latitude by locating the decimal point
    const latDecimalIdx = latStr.indexOf('.');
    if (latDecimalIdx < 2) {
      throw new Error(`Malformed latitude string: ${latStr}`);
    }
    const latSplitIdx = latDecimalIdx - 2;
    const latDeg = parseFloat(latStr.substring(0, latSplitIdx));
    const latMin = parseFloat(latStr.substring(latSplitIdx));
    let lat = latDeg + latMin / 60;
    if (latHem === 'S') lat = -lat;

    // Parse Longitude by locating the decimal point
    const lngDecimalIdx = lngStr.indexOf('.');
    if (lngDecimalIdx < 2) {
      throw new Error(`Malformed longitude string: ${lngStr}`);
    }
    const lngSplitIdx = lngDecimalIdx - 2;
    const lngDeg = parseFloat(lngStr.substring(0, lngSplitIdx));
    const lngMin = parseFloat(lngStr.substring(lngSplitIdx));
    let lng = lngDeg + lngMin / 60;
    if (lngHem === 'W') lng = -lng;

    if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
      throw new Error(
        `Coordinate values parsed as NaN or non-finite: lat=${lat}, lng=${lng}`,
      );
    }

    return { lat, lng };
  }

  private parseDateTime(dateStr: string, timeStr: string): Date {
    if (!dateStr || !timeStr || dateStr.length !== 6 || timeStr.length !== 6) {
      throw new Error(
        `Malformed date/time strings: date="${dateStr}", time="${timeStr}"`,
      );
    }

    const dd = parseInt(dateStr.substring(0, 2), 10);
    const mm = parseInt(dateStr.substring(2, 4), 10);
    const yy = parseInt(dateStr.substring(4, 6), 10);

    const hh = parseInt(timeStr.substring(0, 2), 10);
    const min = parseInt(timeStr.substring(2, 4), 10);
    const ss = parseInt(timeStr.substring(4, 6), 10);

    if (
      isNaN(dd) ||
      isNaN(mm) ||
      isNaN(yy) ||
      isNaN(hh) ||
      isNaN(min) ||
      isNaN(ss)
    ) {
      throw new Error(`Date/time strings contain non-numeric characters`);
    }

    const year = 2000 + yy;
    const monthIndex = mm - 1; // 0-indexed month index

    const utcTimestamp = Date.UTC(year, monthIndex, dd, hh, min, ss);
    const dateObj = new Date(utcTimestamp);

    if (isNaN(dateObj.getTime())) {
      throw new Error('Parsed Date object is invalid');
    }

    return dateObj;
  }

  /**
   * Helper to extract battery voltage (batteryV) and calculate accurate battery percentage (batteryPct)
   * from SinoTrack ST-901 ASCII GPRS packet parts and statusHex.
   *
   * Handles high-voltage E-Bike battery wiring (72V, 60V, 48V E-Motos) as well as 12V ICE bikes
   * and 3.7V internal tracker backup batteries.
   */
  private extractBatteryInfo(
    statusHex?: string,
    parts?: string[],
  ): { batteryV?: number; batteryPct?: number } {
    let batteryV: number | undefined = undefined;
    let batteryPct: number | undefined = undefined;

    // 1. Check extended fields in parts (skip cell tower LBS fields starting at index 13 if present)
    if (parts && parts.length > 13) {
      const startIndex = parts.length >= 17 ? 17 : 13;
      for (let i = startIndex; i < parts.length; i++) {
        const p = parts[i]?.trim();
        if (!p) continue;

        // Check if string ends with 'V' or 'v' (e.g. "72.8V", "65.0V", "12.4V", "4.1V")
        if (/^\d+(\.\d+)?v$/i.test(p)) {
          const val = parseFloat(p.replace(/v$/i, ''));
          if (!isNaN(val) && val > 0 && val <= 200) {
            batteryV = val;
            break;
          }
        }
        // Check if explicit percentage string (e.g. "85%")
        else if (/^\d+%/i.test(p)) {
          const pct = parseFloat(p.replace(/%/i, ''));
          if (!isNaN(pct) && pct >= 0 && pct <= 100) {
            batteryPct = pct;
          }
        }
        // Check for direct numeric voltage in volts or mV
        else {
          const num = parseFloat(p);
          if (!isNaN(num)) {
            if (num >= 3.0 && num <= 120.0 && batteryV === undefined) {
              batteryV = num;
            } else if (num > 120 && num <= 120000 && batteryV === undefined) {
              // Voltage in mV (e.g. 72800 = 72.8V, 65000 = 65.0V, 4150 = 4.15V)
              batteryV = num / 1000;
            } else if (num > 0 && num <= 1.0 && batteryPct === undefined) {
              // Status level ratio (e.g. 0.6 = level 6/6 full 100%)
              batteryPct = num === 0.6 ? 100 : Math.round(num * 100);
            }
          }
        }
      }
    }

    // 3. Compute accurate E-Bike State of Charge (SoC / Percentage) from Voltage (batteryV):
    if (batteryV !== undefined) {
      // Clean up low decimal ratio artifacts (< 3.0V)
      if (batteryV < 3.0) {
        if (batteryPct === undefined) {
          batteryPct = batteryV === 0.6 ? 100 : Math.round(batteryV * 100);
        }
        batteryV = undefined;
      }
      // 72V E-Bike System (Max: 84.0V full charge, Cutoff: 60.0V empty)
      else if (batteryV > 58.0 && batteryV <= 90.0) {
        const pct = ((batteryV - 60.0) / 24.0) * 100;
        batteryPct = Math.min(100, Math.max(0, Math.round(pct)));
      }
      // 60V E-Bike System (Max: 70.0V full charge, Cutoff: 50.0V empty)
      else if (batteryV > 46.0 && batteryV <= 58.0) {
        const pct = ((batteryV - 50.0) / 20.0) * 100;
        batteryPct = Math.min(100, Math.max(0, Math.round(pct)));
      }
      // 48V E-Bike System (Max: 54.6V full charge, Cutoff: 40.0V empty)
      else if (batteryV > 35.0 && batteryV <= 46.0) {
        const pct = ((batteryV - 40.0) / 14.6) * 100;
        batteryPct = Math.min(100, Math.max(0, Math.round(pct)));
      }
      // 24V Nominal / Scaled E-Bike System (Max: 27.5V full charge, Cutoff: 19.0V empty)
      else if (batteryV > 15.0 && batteryV <= 35.0) {
        const pct = ((batteryV - 19.0) / 8.5) * 100;
        batteryPct = Math.min(100, Math.max(0, Math.round(pct)));
      }
      // 12V ICE Motorcycle System (Max: 13.8V, Cutoff: 10.5V)
      else if (batteryV > 6.0 && batteryV <= 15.0) {
        const pct = ((batteryV - 10.5) / 3.3) * 100;
        batteryPct = Math.min(100, Math.max(0, Math.round(pct)));
      }
      // 3.7V Internal Tracker Backup Battery (Max: 4.2V, Cutoff: 3.5V)
      else if (batteryV >= 3.0 && batteryV <= 6.0) {
        const pct = ((batteryV - 3.5) / 0.7) * 100;
        batteryPct = Math.min(100, Math.max(0, Math.round(pct)));
      }
    }

    return { batteryV, batteryPct };
  }

  private async loadDeviceByImei(
    imei: string,
  ): Promise<DeviceForIngestion | null> {
    return this.prismaService.device.findUnique({
      where: { imei },
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
          accelX: '',
          accelY: '',
          accelZ: '',
          batteryV: '',
          ignition: telemetryPayload.ignition ? 'true' : 'false',
        },
        this.streamMaxLen,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to publish telemetry stream for device=${device.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  private async handleMqttCommand(
    topic: string,
    rawPayload: string,
  ): Promise<void> {
    const topicParts = topic.split('/');
    if (topicParts.length < 4) return;
    const deviceUid = topicParts[2];

    const connection = this.activeConnections.get(deviceUid);
    if (!connection) {
      // Not connected to this specific TCP server node instance
      return;
    }

    try {
      // Load device secret first to be able to verify signature
      const device = await this.prismaService.device.findUnique({
        where: { deviceUid },
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
        throw new Error('Device not found for command verification');
      }

      const deviceSecret = this.decryptAndValidateSecret(device);

      // Parse and validate MQTT JSON payload structure
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawPayload);
      } catch {
        throw new Error('Invalid JSON format in command payload');
      }

      const parsedPayload = commandDownlinkPayloadSchema.safeParse(parsedJson);
      if (!parsedPayload.success) {
        throw new Error(
          `Command validation failed: ${parsedPayload.error.message}`,
        );
      }

      const command = parsedPayload.data;

      // Validate cryptographic HMAC signature using device-specific secret
      const isSignatureValid = verifyPayloadSignature(deviceSecret, command);
      if (!isSignatureValid) {
        throw new Error('HMAC signature mismatch on command');
      }

      // Check for timestamp drift (max 5 minutes)
      assertTimestampDrift(command.ts);

      // Defend against replay attacks using Redis nonce check
      await assertNonceNotReplayed(this.redisService, deviceUid, command.nonce);

      this.logger.log(
        `Received and validated outbound MQTT command ${command.type} for SinoTrack deviceUid=${deviceUid}`,
      );

      let sinotrackCmd = '';
      if (command.type === 'LOCK') {
        sinotrackCmd = `940${this.devicePassword}`; // Cut off fuel/ignition
      } else if (command.type === 'UNLOCK') {
        sinotrackCmd = `941${this.devicePassword}`; // Restore fuel/ignition
      } else {
        this.logger.warn(
          `SinoTrack adapter does not support command type ${command.type as string}`,
        );
        return;
      }

      const packet = `*HQ,${connection.imei},${sinotrackCmd}#`;
      connection.socket.write(packet, 'ascii', () => {
        this.logger.log(
          `Successfully dispatched raw TCP packet to SinoTrack device imei=${connection.imei}: ${packet}`,
        );
      });

      const ackTopic = `v1/devices/${deviceUid}/command-ack`;
      const ackPayload = {
        commandId: command.commandId,
        status: 'ACKED',
        ts: new Date().toISOString(),
        nonce: `ack-${command.commandId}-${Date.now()}`,
      };

      const sig = computePayloadSignature(deviceSecret, ackPayload);
      const signedPayload = {
        ...ackPayload,
        sig,
      };

      if (this.mqttClient) {
        this.mqttClient.publish(
          ackTopic,
          JSON.stringify(signedPayload),
          { qos: 1 },
          (err) => {
            if (err) {
              this.logger.error(
                `Failed to publish command-ack to MQTT: ${err.message}`,
              );
            } else {
              this.logger.log(
                `Published signed command-ack for commandId=${command.commandId} back to MQTT`,
              );
            }
          },
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `Failed to execute and ack MQTT command for SinoTrack: ${msg}`,
      );
    }
  }

  private decryptAndValidateSecret(device: {
    secretEncrypted: string | null;
    secretHash: string;
  }): string {
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

  /**
   * Dispatches a LOCK or UNLOCK command directly to an active SinoTrack TCP socket connection if connected.
   */
  public dispatchDirectCommand(
    deviceUid: string,
    type: 'LOCK' | 'UNLOCK',
  ): boolean {
    let connection = this.activeConnections.get(deviceUid);
    if (
      (!connection || !connection.socket || connection.socket.destroyed) &&
      deviceUid
    ) {
      for (const entry of this.activeConnections.values()) {
        if (
          entry.imei === deviceUid &&
          entry.socket &&
          !entry.socket.destroyed
        ) {
          connection = entry;
          break;
        }
      }
    }

    if (!connection || !connection.socket || connection.socket.destroyed) {
      return false;
    }

    const hhmmss = new Date().toISOString().substring(11, 19).replace(/:/g, '');
    const s20Cmd = type === 'LOCK' ? `S20,${hhmmss},1,1` : `S20,${hhmmss},0,1`;
    const s20Packet = `*HQ,${connection.imei},${s20Cmd}#`;
    const sinotrackCmd =
      type === 'LOCK'
        ? `940${this.devicePassword}`
        : `941${this.devicePassword}`;
    const hqPacket = `*HQ,${connection.imei},${sinotrackCmd}#`;
    const combinedPackets = `${s20Packet}\r\n${hqPacket}\r\n`;

    try {
      connection.socket.write(combinedPackets, 'ascii', () => {
        this.logger.log(
          `Directly dispatched SinoTrack GPRS TCP packets to imei=${connection.imei} (deviceUid=${deviceUid}): ${s20Packet} & ${hqPacket}`,
        );
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `Failed to send direct TCP packet to SinoTrack deviceUid=${deviceUid}: ${msg}`,
      );
      return false;
    }
  }

  private timingSafeHexEqual(leftHex: string, rightHex: string): boolean {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  }
}
