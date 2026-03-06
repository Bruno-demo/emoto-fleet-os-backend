import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { AuthenticatedPartner } from '../partner/partner.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type {
  IncidentEvidencePackResponse,
  IncidentEvidenceSummary,
} from './evidence.types';

const EVIDENCE_WINDOW_SECONDS = 120;

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // Generates or loads incident evidence pack for fleet-authenticated users.
  async getEvidencePackForFleetUser(
    user: AuthenticatedUser,
    incidentId: string,
  ): Promise<IncidentEvidencePackResponse> {
    const incident = await this.loadIncidentBundleOrThrow(incidentId);
    if (incident.fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }

    return this.getOrCreateEvidencePack(incident);
  }

  // Generates or loads incident evidence pack for partner-authenticated clients.
  async getEvidencePackForPartner(
    partner: AuthenticatedPartner,
    incidentId: string,
  ): Promise<IncidentEvidencePackResponse> {
    const incident = await this.loadIncidentBundleOrThrow(incidentId);
    const fleetAccess = await this.prismaService.partnerFleetAccess.findUnique({
      where: {
        partnerId_fleetId: {
          partnerId: partner.partnerId,
          fleetId: incident.fleetId,
        },
      },
      select: {
        active: true,
      },
    });
    if (!fleetAccess?.active) {
      throw new ForbiddenException('Partner fleet access denied');
    }

    return this.getOrCreateEvidencePack(incident);
  }

  // Creates one evidence pack snapshot when absent and returns presigned file URLs.
  private async getOrCreateEvidencePack(
    incident: IncidentBundle,
  ): Promise<IncidentEvidencePackResponse> {
    const existingPack = await this.prismaService.evidencePack.findUnique({
      where: {
        incidentId: incident.id,
      },
    });

    const evidencePack =
      existingPack ?? (await this.generateAndPersistEvidencePack(incident));
    const expiresInSeconds = this.storageService.getPresignedExpirySeconds();
    const [summaryJsonUrl, telemetryCsvUrl] = await Promise.all([
      this.storageService.createPresignedGetUrl(evidencePack.s3KeyJson),
      this.storageService.createPresignedGetUrl(evidencePack.s3KeyCsv),
    ]);

    return {
      evidencePackId: evidencePack.id,
      incidentId: incident.id,
      fleetId: incident.fleetId,
      createdAt: evidencePack.createdAt.toISOString(),
      expiresInSeconds,
      summaryJsonUrl,
      telemetryCsvUrl,
    };
  }

  // Produces summary JSON and telemetry CSV artifacts and stores pack metadata.
  private async generateAndPersistEvidencePack(incident: IncidentBundle) {
    const crashTs = incident.event.ts;
    const telemetryWindowStart = new Date(
      crashTs.getTime() - EVIDENCE_WINDOW_SECONDS * 1000,
    );
    const telemetryWindowEnd = new Date(
      crashTs.getTime() + EVIDENCE_WINDOW_SECONDS * 1000,
    );

    const [trip, relatedEvents, telemetryRows] = await Promise.all([
      incident.bikeId
        ? this.prismaService.trip.findFirst({
            where: {
              fleetId: incident.fleetId,
              bikeId: incident.bikeId,
              startTs: { lte: crashTs },
              OR: [{ endTs: null }, { endTs: { gte: crashTs } }],
            },
            orderBy: {
              startTs: 'desc',
            },
          })
        : Promise.resolve(null),
      this.prismaService.event.findMany({
        where: {
          fleetId: incident.fleetId,
          ts: {
            gte: telemetryWindowStart,
            lte: telemetryWindowEnd,
          },
          ...(incident.bikeId
            ? { bikeId: incident.bikeId }
            : { deviceId: incident.deviceId }),
        },
        orderBy: {
          ts: 'asc',
        },
      }),
      this.prismaService.telemetryPoint.findMany({
        where: {
          deviceId: incident.deviceId,
          ts: {
            gte: telemetryWindowStart,
            lte: telemetryWindowEnd,
          },
        },
        orderBy: {
          ts: 'asc',
        },
      }),
    ]);

    const summaryPayload: IncidentEvidenceSummary = {
      incident: {
        id: incident.id,
        fleetId: incident.fleetId,
        bikeId: incident.bikeId,
        deviceId: incident.deviceId,
        eventId: incident.eventId.toString(),
        status: incident.status,
        createdAt: incident.createdAt.toISOString(),
      },
      bike: incident.bike
        ? {
            id: incident.bike.id,
            label: incident.bike.label,
            plate: incident.bike.plate,
            serial: incident.bike.serial,
            model: incident.bike.model,
            status: incident.bike.status,
          }
        : null,
      device: {
        id: incident.device.id,
        deviceUid: incident.device.deviceUid,
        imei: incident.device.imei,
        fwVersion: incident.device.fwVersion,
        status: incident.device.status,
        lastSeenAt: incident.device.lastSeenAt?.toISOString() ?? null,
      },
      trip: trip
        ? {
            id: trip.id,
            startTs: trip.startTs.toISOString(),
            endTs: trip.endTs?.toISOString() ?? null,
            distanceKm: Number(trip.distanceKm),
            durationSec: trip.durationSec,
            score: Number(trip.score),
          }
        : null,
      events: relatedEvents.map((event) => ({
        id: event.id.toString(),
        ts: event.ts.toISOString(),
        type: event.type,
        severity: event.severity,
        metaJson: event.metaJson,
      })),
      telemetry: {
        windowStartTs: telemetryWindowStart.toISOString(),
        windowEndTs: telemetryWindowEnd.toISOString(),
        rowCount: telemetryRows.length,
      },
    };

    const csvPayload = this.toTelemetryCsv(telemetryRows);
    const evidenceBaseKey = `evidence/${incident.fleetId}/${incident.id}`;
    const s3KeyJson = `${evidenceBaseKey}/summary.json`;
    const s3KeyCsv = `${evidenceBaseKey}/telemetry-window.csv`;

    await Promise.all([
      this.storageService.uploadJson(s3KeyJson, summaryPayload),
      this.storageService.uploadText(
        s3KeyCsv,
        csvPayload,
        'text/csv; charset=utf-8',
      ),
    ]);

    return this.prismaService.evidencePack.create({
      data: {
        incidentId: incident.id,
        s3KeyJson,
        s3KeyCsv,
      },
    });
  }

  // Fetches incident bundle needed for evidence generation.
  private async loadIncidentBundleOrThrow(
    incidentId: string,
  ): Promise<IncidentBundle> {
    const incident = await this.prismaService.incident.findUnique({
      where: {
        id: incidentId,
      },
      include: {
        event: true,
        bike: true,
        device: true,
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    if (incident.event.type !== 'CRASH') {
      throw new ForbiddenException(
        'Evidence packs are available only for crash incidents',
      );
    }

    return incident;
  }

  // Serializes telemetry points into RFC-4180 style CSV output.
  private toTelemetryCsv(
    rows: Array<{
      ts: Date;
      lat: Prisma.Decimal;
      lng: Prisma.Decimal;
      speedKph: Prisma.Decimal;
      heading: Prisma.Decimal | null;
      accelX: Prisma.Decimal | null;
      accelY: Prisma.Decimal | null;
      accelZ: Prisma.Decimal | null;
      batteryV: Prisma.Decimal | null;
      ignition: boolean | null;
    }>,
  ): string {
    const header =
      'ts,lat,lng,speedKph,heading,accelX,accelY,accelZ,batteryV,ignition';
    const lines = rows.map((row) =>
      [
        row.ts.toISOString(),
        Number(row.lat),
        Number(row.lng),
        Number(row.speedKph),
        this.toNullableCsvValue(row.heading),
        this.toNullableCsvValue(row.accelX),
        this.toNullableCsvValue(row.accelY),
        this.toNullableCsvValue(row.accelZ),
        this.toNullableCsvValue(row.batteryV),
        row.ignition === null ? '' : row.ignition ? 'true' : 'false',
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }

  // Converts nullable decimals into CSV-safe scalar strings.
  private toNullableCsvValue(value: Prisma.Decimal | null): string {
    if (value === null) {
      return '';
    }

    return String(Number(value));
  }
}

type IncidentBundle = Prisma.IncidentGetPayload<{
  include: {
    event: true;
    bike: true;
    device: true;
  };
}>;
