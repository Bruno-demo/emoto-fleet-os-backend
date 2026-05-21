import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTripEventCounts } from '../trips/trip-scoring.util';
import { WeeklyReport, WeeklyRiskBike, WeeklyRiskRider } from './reports.types';

interface AggregatedBikeMetrics {
  bikeId: string;
  tripCount: number;
  scoreSum: number;
  eventCount: number;
}

interface AggregatedRiderMetrics {
  riderId: string;
  tripCount: number;
  scoreSum: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prismaService: PrismaService) {}

  // Builds a 7-day fleet summary report for scoring and risk ranking.
  async getWeeklyReport(user: AuthenticatedUser, fromStr?: string, toStr?: string): Promise<WeeklyReport> {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    let insurerBikeFilter: { bikeId?: { in: string[] } } = {};
    if (user.role === 'INSURER') {
      const insuredBikes = await this.prismaService.bike.findMany({
        where: { insurerUserId: user.id, fleetId: user.fleetId },
        select: { id: true },
      });
      const bikeIds = insuredBikes.map(b => b.id);
      insurerBikeFilter = { bikeId: { in: bikeIds } };
    }

    const [trips, groupedEvents] = await Promise.all([
      this.prismaService.trip.findMany({
        where: {
          fleetId: user.fleetId,
          startTs: {
            gte: from,
            lte: to,
          },
          ...insurerBikeFilter,
        },
        select: {
          id: true,
          bikeId: true,
          riderId: true,
          score: true,
        },
      }),
      this.prismaService.event.groupBy({
        by: ['type', 'bikeId'],
        where: {
          fleetId: user.fleetId,
          ts: {
            gte: from,
            lte: to,
          },
          ...insurerBikeFilter,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const eventCounts = normalizeTripEventCounts(
      groupedEvents.map((row) => ({
        type: row.type,
        count: row._count._all,
      })),
    );

    const bikeMetrics = this.aggregateBikeMetrics(trips, groupedEvents);
    const riderMetrics = this.aggregateRiderMetrics(trips);
    const bikeLabels = await this.loadBikeLabels(
      bikeMetrics.map((metric) => metric.bikeId),
    );
    const riderNames = await this.loadRiderNames(
      riderMetrics.map((metric) => metric.riderId),
    );

    const topRiskyBikes = this.buildTopRiskyBikes(bikeMetrics, bikeLabels);
    const topRiskyRiders = this.buildTopRiskyRiders(riderMetrics, riderNames);
    const avgScore =
      trips.length === 0
        ? 100
        : trips.reduce((sum, trip) => sum + Number(trip.score), 0) /
          trips.length;

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      tripCount: trips.length,
      avgScore: Number(avgScore.toFixed(2)),
      eventCounts,
      topRiskyBikes,
      topRiskyRiders,
    };
  }

  // Aggregates per-bike score and event totals for fleet risk ranking.
  private aggregateBikeMetrics(
    trips: Array<{ bikeId: string; score: { toNumber: () => number } }>,
    groupedEvents: Array<{ bikeId: string | null; _count: { _all: number } }>,
  ): AggregatedBikeMetrics[] {
    const metrics = new Map<string, AggregatedBikeMetrics>();

    for (const trip of trips) {
      const existing = metrics.get(trip.bikeId) ?? {
        bikeId: trip.bikeId,
        tripCount: 0,
        scoreSum: 0,
        eventCount: 0,
      };
      existing.tripCount += 1;
      existing.scoreSum += Number(trip.score);
      metrics.set(trip.bikeId, existing);
    }

    for (const event of groupedEvents) {
      if (!event.bikeId) {
        continue;
      }

      const existing = metrics.get(event.bikeId) ?? {
        bikeId: event.bikeId,
        tripCount: 0,
        scoreSum: 0,
        eventCount: 0,
      };
      existing.eventCount += event._count._all;
      metrics.set(event.bikeId, existing);
    }

    return Array.from(metrics.values());
  }

  // Aggregates rider trip scoring metrics from fleet trips.
  private aggregateRiderMetrics(
    trips: Array<{ riderId: string | null; score: { toNumber: () => number } }>,
  ): AggregatedRiderMetrics[] {
    const metrics = new Map<string, AggregatedRiderMetrics>();

    for (const trip of trips) {
      if (!trip.riderId) {
        continue;
      }

      const existing = metrics.get(trip.riderId) ?? {
        riderId: trip.riderId,
        tripCount: 0,
        scoreSum: 0,
      };
      existing.tripCount += 1;
      existing.scoreSum += Number(trip.score);
      metrics.set(trip.riderId, existing);
    }

    return Array.from(metrics.values());
  }

  // Fetches bike labels used in weekly risk report output.
  private async loadBikeLabels(
    bikeIds: string[],
  ): Promise<Map<string, string>> {
    if (bikeIds.length === 0) {
      return new Map();
    }

    const bikes = await this.prismaService.bike.findMany({
      where: {
        id: { in: bikeIds },
      },
      select: {
        id: true,
        label: true,
      },
    });

    return new Map(bikes.map((bike) => [bike.id, bike.label]));
  }

  // Builds sorted top-risk bike list using low score and high event frequency.
  private buildTopRiskyBikes(
    bikeMetrics: AggregatedBikeMetrics[],
    bikeLabels: Map<string, string>,
  ): WeeklyRiskBike[] {
    return bikeMetrics
      .map((metric) => {
        const avgScore =
          metric.tripCount === 0 ? 100 : metric.scoreSum / metric.tripCount;
        return {
          bikeId: metric.bikeId,
          label: bikeLabels.get(metric.bikeId) ?? 'Unknown',
          tripCount: metric.tripCount,
          avgScore: Number(avgScore.toFixed(2)),
          eventCount: metric.eventCount,
          riskIndex:
            100 -
            avgScore +
            (metric.eventCount / Math.max(metric.tripCount, 1)) * 2,
        };
      })
      .sort((left, right) => right.riskIndex - left.riskIndex)
      .slice(0, 5)
      .map((bikeWithRisk) => {
        const { riskIndex, ...bike } = bikeWithRisk;
        void riskIndex;
        return bike;
      });
  }

  private async loadRiderNames(
    riderIds: string[],
  ): Promise<Map<string, string>> {
    if (riderIds.length === 0) {
      return new Map();
    }

    const users = await this.prismaService.user.findMany({
      where: {
        id: { in: riderIds },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        riderProfile: {
          select: {
            fullName: true,
          },
        },
      },
    });

    return new Map(
      users.map((u) => {
        const name = u.riderProfile?.fullName || u.email || u.phone || `Rider ${u.id.slice(0, 8)}`;
        return [u.id, name];
      }),
    );
  }

  // Builds sorted top-risk rider list using average trip score.
  private buildTopRiskyRiders(
    riderMetrics: AggregatedRiderMetrics[],
    riderNames: Map<string, string>,
  ): WeeklyRiskRider[] {
    return riderMetrics
      .map((metric) => ({
        riderId: metric.riderId,
        fullName: riderNames.get(metric.riderId) ?? 'Unknown',
        tripCount: metric.tripCount,
        avgScore: Number((metric.scoreSum / metric.tripCount).toFixed(2)),
      }))
      .sort((left, right) => left.avgScore - right.avgScore)
      .slice(0, 5);
  }
}
