import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus } from '@prisma/client';
import * as net from 'net';
import { TelemetryPayload } from '../mqtt/mqtt-validation.util';
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

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly liveStateService: LiveStateService,
    private readonly rulesEngineService: RulesEngineService,
    private readonly tripBuilderService: TripBuilderService,
    private readonly metricsService: MetricsService,
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
  }

  onModuleDestroy(): void {
    this.logger.log('Shutting down SinoTrack TCP Server...');
    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();

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
        void this.processRawPacket(rawPacket);
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
    });
  }

  private async processRawPacket(rawPacket: string): Promise<void> {
    const trimmed = rawPacket.trim();
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

      if (command === 'V1') {
        await this.processTelemetryPacket(device, parts, trimmed);
      } else {
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
    rawPacket: string,
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

    // If validity is Void, we don't process coordinates since they're inaccurate.
    // We update keep-alive instead.
    if (validity !== 'A') {
      this.logger.debug(
        `Device IMEI=${parts[1]} reported invalid GPS fix (V). Updating keep-alive.`,
      );
      await this.processHeartbeatPacket(device);
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

    // Parse Ignition status (ACC) from status hex (active-low negative logic on the 3rd byte)
    let ignition = true;
    if (statusHex && statusHex.length >= 6) {
      const thirdByteHex = statusHex.substring(4, 6);
      const thirdByte = parseInt(thirdByteHex, 16);
      if (!isNaN(thirdByte)) {
        ignition = (thirdByte & 0x04) === 0;
      }
    }

    // Construct telemetry payload for internal components
    const telemetryPayload: TelemetryPayload = {
      ts: ts.toISOString(),
      lat,
      lng,
      speedKph,
      heading: isNaN(heading) ? undefined : heading,
      ignition,
      nonce: `sinotrack-${device.id}-${ts.getTime()}`,
      sig: 'bypassed-sinotrack-secure-local-adapter',
    };

    // Execute standard TimescaleDB and Prisma transaction
    await this.prismaService.$transaction([
      this.prismaService.telemetryPoint.create({
        data: {
          deviceId: device.id,
          ts,
          lat,
          lng,
          speedKph,
          heading: isNaN(heading) ? null : heading,
          ignition,
        },
      }),
      this.prismaService.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: ts,
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
        lat,
        lng,
        speedKph,
        heading: telemetryPayload.heading,
        ignition,
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
    this.metricsService.incrementMqttIngestion('sinotrack', 'accepted');
  }

  private parseCoordinates(
    latStr: string,
    latHem: string,
    lngStr: string,
    lngHem: string,
  ): { lat: number; lng: number } {
    if (!latStr || !lngStr || latStr.length < 4 || lngStr.length < 5) {
      throw new Error(
        `Invalid coordinate length (lat: ${latStr?.length}, lng: ${lngStr?.length})`,
      );
    }

    const latDeg = parseFloat(latStr.substring(0, 2));
    const latMin = parseFloat(latStr.substring(2));
    let lat = latDeg + latMin / 60;
    if (latHem === 'S') lat = -lat;

    const lngDeg = parseFloat(lngStr.substring(0, 3));
    const lngMin = parseFloat(lngStr.substring(3));
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
}
