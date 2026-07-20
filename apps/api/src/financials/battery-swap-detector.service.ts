import { Injectable, Logger } from '@nestjs/common';
import { AuditActionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { LiveBikeState } from '../ingestion/ingestion.types';

@Injectable()
export class BatterySwapDetectorService {
  private readonly logger = new Logger(BatterySwapDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Evaluates incoming live bike state telemetry against previous state
   * to automatically detect battery swaps without manual admin entry.
   */
  async evaluateTelemetryForSwap(
    prevState: LiveBikeState | null,
    nextState: LiveBikeState,
  ): Promise<void> {
    if (!prevState || !prevState.ts || !nextState.bikeId || nextState.batteryPct === undefined) {
      return;
    }

    const prevPct = prevState?.batteryPct;
    const nextPct = nextState.batteryPct;

    // We only trigger swap detection if there is a previous sample with a valid percentage
    if (prevPct === undefined || prevPct === null) {
      return;
    }

    const deltaSoC = nextPct - prevPct;

    // Check time delta between samples (must be within 15 minutes)
    const prevTime = new Date(prevState.ts).getTime();
    const nextTime = new Date(nextState.ts).getTime();
    const deltaMs = Math.abs(nextTime - prevTime);
    const deltaMinutes = deltaMs / (1000 * 60);

    // Battery swap condition: positive SoC jump of >= +18% within 15 minutes
    if (deltaSoC < 18 || deltaMinutes > 15) {
      return;
    }

    // Cooldown check: Ensure we haven't already auto-logged a swap for this bike in the last 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentSwap = await this.prisma.batterySwap.findFirst({
      where: {
        bikeId: nextState.bikeId,
        ts: { gte: fifteenMinsAgo },
      },
    });

    if (recentSwap) {
      this.logger.debug(
        `Battery swap already logged for bike ${nextState.bikeId} within 15 minutes. Skipping.`,
      );
      return;
    }

    // 1. Determine active rider assignment
    const activeAssignment = await this.prisma.bikeAssignment.findFirst({
      where: {
        bikeId: nextState.bikeId,
        active: true,
      },
      select: {
        riderUserId: true,
      },
    });

    // 2. Identify nearest swap station POI (within 500m) or default to Kigali station
    const nearestPoi = await this.findNearestSwapStation(
      nextState.lat,
      nextState.lng,
    );
    const swapStation = nearestPoi ? nearestPoi.name : 'Kigali Central Station';

    // 3. Classify Swap Type & Cost
    const unitPriceRwf = 2500;
    let swapType = 'FULL';
    let fraction = 1.0;

    if (deltaSoC >= 65 || nextPct >= 85) {
      swapType = 'FULL';
      fraction = 1.0;
    } else if (deltaSoC >= 35) {
      swapType = 'HALF';
      fraction = 0.5;
    } else if (deltaSoC >= 18) {
      swapType = 'QUARTER';
      fraction = 0.25;
    } else {
      swapType = 'CUSTOM';
      fraction = Math.min(1.0, Math.max(0.1, Math.round((deltaSoC / 100) * 100) / 100));
    }

    const totalCostRwf = Math.round(unitPriceRwf * fraction);
    const timestamp = new Date(nextState.ts);

    // 4. Create BatterySwap record automatically
    const swap = await this.prisma.batterySwap.create({
      data: {
        fleetId: nextState.fleetId,
        bikeId: nextState.bikeId,
        riderId: activeAssignment?.riderUserId || null,
        swapStation,
        swapType,
        fraction,
        unitPriceRwf,
        totalCostRwf,
        soCOutPct: Math.round(prevPct),
        soCInPct: Math.round(nextPct),
        ts: timestamp,
        notes: `[Auto-Detected] Battery SoC jump +${Math.round(deltaSoC)}% (${Math.round(prevPct)}% -> ${Math.round(nextPct)}%) in ${Math.round(deltaMinutes)}m`,
      },
      include: {
        bike: { select: { id: true, label: true, plate: true } },
        rider: { select: { id: true, riderProfile: { select: { fullName: true } } } },
      },
    });

    this.logger.log(
      `✨ Automatically detected and recorded ${swapType} battery swap for Bike ${swap.bike?.label ?? nextState.bikeId}: +${Math.round(deltaSoC)}% -> ${totalCostRwf} RWF`,
    );

    // 5. Audit Log Entry
    await this.auditService.createAuditLog({
      fleetId: nextState.fleetId,
      actorUserId: nextState.deviceId,
      actionType: AuditActionType.RIDER_PAYMENT_RECORDED,
      targetType: 'BATTERY_SWAP',
      targetId: swap.id,
      metaJson: {
        autoDetected: true,
        swapType,
        fraction,
        totalCostRwf,
        prevPct,
        nextPct,
        deltaSoC,
        bikeId: nextState.bikeId,
        riderId: activeAssignment?.riderUserId,
      },
    });
  }

  private async findNearestSwapStation(
    lat: number,
    lng: number,
  ): Promise<{ name: string } | null> {
    try {
      const pois = await this.prisma.poi.findMany({
        where: { type: 'SWAP' },
        select: { name: true, lat: true, lng: true },
      });

      let minDistance = Infinity;
      let closest: { name: string } | null = null;

      for (const p of pois) {
        const pLat = Number(p.lat);
        const pLng = Number(p.lng);
        const distKm = this.haversineKm(lat, lng, pLat, pLng);
        if (distKm <= 0.5 && distKm < minDistance) {
          minDistance = distKm;
          closest = { name: p.name };
        }
      }
      return closest;
    } catch {
      return null;
    }
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
