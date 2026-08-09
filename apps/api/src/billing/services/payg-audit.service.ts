import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PaygActiveDayRecord {
  date: string;
  bikeId: string;
  bikeLabel?: string;
  bikePlate?: string | null;
  distanceKm: number;
  tripCount: number;
  isActive: boolean;
  chargeRwf: number;
}

export interface PaygAuditSummary {
  fleetId: string;
  fleetName: string;
  billingMode: string;
  paygRatePerActiveDay: number;
  periodStart: Date;
  periodEnd: Date;
  totalBikes: number;
  totalActiveBikeDays: number;
  totalExemptBikeDays: number;
  totalPaygSubtotalRwf: number;
  perBikeSummary: Array<{
    bikeId: string;
    bikeLabel: string;
    bikePlate: string | null;
    activeDays: number;
    exemptDays: number;
    totalDistanceKm: number;
    paygChargesRwf: number;
  }>;
  dailyBreakdown: PaygActiveDayRecord[];
}

@Injectable()
export class PaygAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaygAuditForFleet(
    fleetId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<PaygAuditSummary> {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      include: {
        bikes: {
          select: { id: true, label: true, plate: true, status: true },
        },
      },
    });

    if (!fleet) {
      throw new NotFoundException('Fleet not found');
    }

    const paygRate = fleet.emotoPaygRatePerActiveDay ?? 350;
    const now = new Date();

    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const bikes = fleet.bikes;

    const trips = await this.prisma.trip.findMany({
      where: {
        fleetId,
        startTs: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        bikeId: true,
        startTs: true,
        distanceKm: true,
      },
    });

    const bikeDayMap = new Map<
      string,
      { distanceKm: number; tripCount: number }
    >();

    for (const trip of trips) {
      const dateStr = trip.startTs.toISOString().slice(0, 10);
      const key = `${trip.bikeId}_${dateStr}`;
      const dist = Number(trip.distanceKm || 0);
      const existing = bikeDayMap.get(key) || { distanceKm: 0, tripCount: 0 };
      bikeDayMap.set(key, {
        distanceKm: existing.distanceKm + dist,
        tripCount: existing.tripCount + 1,
      });
    }

    const dayStrings: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dayStrings.push(curr.toISOString().slice(0, 10));
      curr.setDate(curr.getDate() + 1);
    }

    const dailyBreakdown: PaygActiveDayRecord[] = [];
    const perBikeStatsMap = new Map<
      string,
      {
        activeDays: number;
        exemptDays: number;
        totalDistanceKm: number;
        paygChargesRwf: number;
      }
    >();

    for (const bike of bikes) {
      perBikeStatsMap.set(bike.id, {
        activeDays: 0,
        exemptDays: 0,
        totalDistanceKm: 0,
        paygChargesRwf: 0,
      });
    }

    let totalActiveBikeDays = 0;
    let totalExemptBikeDays = 0;
    let totalPaygSubtotalRwf = 0;

    for (const dayStr of dayStrings) {
      for (const bike of bikes) {
        const key = `${bike.id}_${dayStr}`;
        const record = bikeDayMap.get(key) || { distanceKm: 0, tripCount: 0 };
        const distanceKm = Math.round(record.distanceKm * 100) / 100;
        const isActive = distanceKm > 0.5 || record.tripCount > 0;
        const chargeRwf = isActive ? paygRate : 0;

        const bikeStats = perBikeStatsMap.get(bike.id) || {
          activeDays: 0,
          exemptDays: 0,
          totalDistanceKm: 0,
          paygChargesRwf: 0,
        };

        if (isActive) {
          totalActiveBikeDays += 1;
          bikeStats.activeDays += 1;
          bikeStats.paygChargesRwf += paygRate;
          totalPaygSubtotalRwf += paygRate;
        } else {
          totalExemptBikeDays += 1;
          bikeStats.exemptDays += 1;
        }

        bikeStats.totalDistanceKm =
          Math.round((bikeStats.totalDistanceKm + distanceKm) * 100) / 100;
        perBikeStatsMap.set(bike.id, bikeStats);

        dailyBreakdown.push({
          date: dayStr,
          bikeId: bike.id,
          bikeLabel: bike.label,
          bikePlate: bike.plate,
          distanceKm,
          tripCount: record.tripCount,
          isActive,
          chargeRwf,
        });
      }
    }

    const perBikeSummary = bikes.map((bike) => {
      const stats = perBikeStatsMap.get(bike.id)!;
      return {
        bikeId: bike.id,
        bikeLabel: bike.label,
        bikePlate: bike.plate,
        activeDays: stats.activeDays,
        exemptDays: stats.exemptDays,
        totalDistanceKm: stats.totalDistanceKm,
        paygChargesRwf: stats.paygChargesRwf,
      };
    });

    return {
      fleetId,
      fleetName: fleet.name,
      billingMode: fleet.billingMode,
      paygRatePerActiveDay: paygRate,
      periodStart: start,
      periodEnd: end,
      totalBikes: bikes.length,
      totalActiveBikeDays,
      totalExemptBikeDays,
      totalPaygSubtotalRwf,
      perBikeSummary,
      dailyBreakdown,
    };
  }
}
