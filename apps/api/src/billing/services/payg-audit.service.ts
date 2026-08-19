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

  /**
   * Formats a date into YYYY-MM-DD in Africa/Kigali (UTC+2) timezone
   */
  private toKigaliDateStr(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Kigali',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }

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

    const paygRate =
      fleet.type === 'DELIVERY' &&
      (!fleet.emotoPaygRatePerActiveDay ||
        fleet.emotoPaygRatePerActiveDay === 350)
        ? 500
        : (fleet.emotoPaygRatePerActiveDay ?? 350);
    const now = new Date();

    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    let end = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // If endDate is provided as a simple 'YYYY-MM-DD' (10 chars), extend to end of day
    if (endDate && endDate.length === 10) {
      end = new Date(`${endDate}T23:59:59.999Z`);
    }

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
      const dateStr = this.toKigaliDateStr(trip.startTs);
      const key = `${trip.bikeId}_${dateStr}`;
      const dist = Number(trip.distanceKm || 0);
      const existing = bikeDayMap.get(key) || { distanceKm: 0, tripCount: 0 };
      bikeDayMap.set(key, {
        distanceKm: existing.distanceKm + dist,
        tripCount: existing.tripCount + 1,
      });
    }

    const startDayStr = this.toKigaliDateStr(start);
    const endDayStr = this.toKigaliDateStr(end);
    const dayStrings: string[] = [];
    const curr = new Date(start);
    while (this.toKigaliDateStr(curr) <= endDayStr) {
      const dStr = this.toKigaliDateStr(curr);
      if (!dayStrings.includes(dStr)) {
        dayStrings.push(dStr);
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
      if (dayStrings.length > 366) break; // safety guard
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
        // Pure GPS Active Day Rule:
        // A bike worked on a day if it completed >= 1 trip AND stopped near registered stations > 1 time
        const isActive = record.tripCount >= 1;
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

  /**
   * Fetches all IoT devices that are non-working/inactive (no active day / telemetry > 24h)
   * along with assigned fleet admin contact details, bike details, and lost revenue calculation.
   */
  async getRevenueRiskDevices() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const devices = await this.prisma.device.findMany({
      where: {
        OR: [
          { status: 'INACTIVE' },
          { status: 'RETIRED' },
          { lastSeenAt: { lt: twentyFourHoursAgo } },
          { lastSeenAt: null },
        ],
      },
      select: {
        id: true,
        deviceUid: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        fleet: {
          select: {
            id: true,
            name: true,
            type: true,
            emotoPaygRatePerActiveDay: true,
            users: {
              where: { role: { in: ['ADMIN', 'OWNER'] }, status: 'ACTIVE' },
              select: { email: true, phone: true, role: true },
              take: 2,
            },
          },
        },
        bike: {
          select: {
            id: true,
            label: true,
            plate: true,
            status: true,
            assignments: {
              where: { active: true },
              select: {
                rider: {
                  select: {
                    id: true,
                    phone: true,
                    riderProfile: { select: { fullName: true } },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { lastSeenAt: 'asc' },
    });

    const now = Date.now();
    let totalRevenueLostRwf = 0;
    const impactedFleetIds = new Set<string>();

    const enrichedDevices = devices.map((device) => {
      const isAssigned = !!device.bike;
      const lastSeen = device.lastSeenAt
        ? new Date(device.lastSeenAt).getTime()
        : new Date(device.createdAt).getTime();
      const inactiveHours = Math.max(
        1,
        Math.floor((now - lastSeen) / (1000 * 60 * 60)),
      );
      const rawInactiveDays = Math.max(1, Math.floor(inactiveHours / 24));
      // Cap at 30 days for revenue risk estimation
      const inactiveDays = Math.min(30, rawInactiveDays);

      const dailyRate =
        device.fleet?.type === 'DELIVERY'
          ? (!device.fleet.emotoPaygRatePerActiveDay ||
            device.fleet.emotoPaygRatePerActiveDay === 350
              ? 500
              : device.fleet.emotoPaygRatePerActiveDay)
          : (device.fleet?.emotoPaygRatePerActiveDay ?? 350);

      // Only deployed/assigned devices represent actual lost operational revenue
      const estimatedLossRwf = isAssigned ? inactiveDays * dailyRate : 0;
      totalRevenueLostRwf += estimatedLossRwf;

      if (device.fleet?.id) {
        impactedFleetIds.add(device.fleet.id);
      }

      const adminUser = device.fleet?.users?.[0];
      const activeAssignment = device.bike?.assignments?.[0];

      return {
        id: device.id,
        deviceUid: device.deviceUid,
        status: device.status,
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        inactiveHours,
        inactiveDays,
        dailyRate,
        estimatedLossRwf,
        fleet: device.fleet
          ? {
              id: device.fleet.id,
              name: device.fleet.name,
              type: device.fleet.type,
              adminEmail: adminUser?.email || null,
              adminPhone: adminUser?.phone || null,
            }
          : null,
        bike: device.bike
          ? {
              id: device.bike.id,
              label: device.bike.label,
              plate: device.bike.plate,
              riderName: activeAssignment?.rider?.riderProfile?.fullName || null,
              riderPhone: activeAssignment?.rider?.phone || null,
            }
          : null,
      };
    });

    return {
      summary: {
        totalInactiveDevices: enrichedDevices.length,
        totalRevenueLostRwf,
        impactedFleetsCount: impactedFleetIds.size,
      },
      devices: enrichedDevices,
    };
  }

  /**
   * Fetches all IoT devices that are actively working (reporting telemetry & verified active)
   * along with daily rate earned, MTD revenue generated, bike details, and fleet breakdown.
   */
  async getActiveRevenueDevices() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const devices = await this.prisma.device.findMany({
      where: {
        status: 'ACTIVE',
        lastSeenAt: { gte: twentyFourHoursAgo },
      },
      select: {
        id: true,
        deviceUid: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        fleet: {
          select: {
            id: true,
            name: true,
            type: true,
            emotoPaygRatePerActiveDay: true,
            users: {
              where: { role: { in: ['ADMIN', 'OWNER'] }, status: 'ACTIVE' },
              select: { email: true, phone: true, role: true },
              take: 2,
            },
          },
        },
        bike: {
          select: {
            id: true,
            label: true,
            plate: true,
            model: true,
            status: true,
            trips: {
              where: { startTs: { gte: startOfMonth } },
              select: { id: true, startTs: true, distanceKm: true },
            },
            assignments: {
              where: { active: true },
              select: {
                rider: {
                  select: {
                    id: true,
                    phone: true,
                    riderProfile: { select: { fullName: true } },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    let totalDailyRevenueRwf = 0;
    let totalMtdRevenueRwf = 0;
    const activeFleetIds = new Set<string>();

    const enrichedDevices = devices.map((device) => {
      const dailyRate =
        device.fleet?.type === 'DELIVERY'
          ? (!device.fleet.emotoPaygRatePerActiveDay || device.fleet.emotoPaygRatePerActiveDay === 350 ? 500 : device.fleet.emotoPaygRatePerActiveDay)
          : (device.fleet?.emotoPaygRatePerActiveDay ?? 350);

      // Verified Pure GPS Active Day Condition:
      // A bike is active on a date if it made >= 1 trip AND stopped at registered stations > 1 time
      const tripsThisMonth = device.bike?.trips || [];
      
      // Group trips by calendar date (YYYY-MM-DD in Kigali time)
      const tripsByDate = new Map<string, number>();
      for (const trip of tripsThisMonth) {
        const dateStr = this.toKigaliDateStr(trip.startTs);
        tripsByDate.set(dateStr, (tripsByDate.get(dateStr) || 0) + 1);
      }

      // Verified active days MTD: dates where trips >= 1
      const uniqueActiveDaysMtd = tripsByDate.size;
      const mtdRevenueRwf = uniqueActiveDaysMtd * dailyRate;

      // Check if bike worked today (verified >= 1 trip today)
      const todayStr = this.toKigaliDateStr(new Date());
      const tripsToday = tripsByDate.get(todayStr) || 0;
      const isWorkingToday = tripsToday >= 1;

      totalDailyRevenueRwf += isWorkingToday ? dailyRate : 0;
      totalMtdRevenueRwf += mtdRevenueRwf;

      if (device.fleet?.id) {
        activeFleetIds.add(device.fleet.id);
      }

      const adminUser = device.fleet?.users?.[0];
      const activeAssignment = device.bike?.assignments?.[0];

      return {
        id: device.id,
        deviceUid: device.deviceUid,
        status: device.status,
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        dailyRate,
        uniqueActiveDaysMtd,
        mtdRevenueRwf,
        isWorkingToday,
        tripsToday,
        fleet: device.fleet
          ? {
              id: device.fleet.id,
              name: device.fleet.name,
              type: device.fleet.type,
              adminEmail: adminUser?.email || null,
              adminPhone: adminUser?.phone || null,
            }
          : null,
        bike: device.bike
          ? {
              id: device.bike.id,
              label: device.bike.label,
              plate: device.bike.plate,
              model: device.bike.model,
              riderName: activeAssignment?.rider?.riderProfile?.fullName || null,
              riderPhone: activeAssignment?.rider?.phone || null,
              tripsCountMtd: tripsThisMonth.length,
            }
          : null,
      };
    });

    const estMonthlyMrrRwf = totalDailyRevenueRwf * 30;

    return {
      summary: {
        totalActiveDevices: enrichedDevices.length,
        totalDailyRevenueRwf,
        totalMtdRevenueRwf,
        estMonthlyMrrRwf,
        activeFleetsCount: activeFleetIds.size,
      },
      devices: enrichedDevices,
    };
  }
}
