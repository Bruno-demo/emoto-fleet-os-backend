import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { Badge, ScoreBadge } from '../components/ui/badge';
import { SectionHeader } from '../components/ui/section-header';
import { CardSkeleton, ListSkeleton } from '../components/ui/skeleton';
import { ScoreRing } from '../components/ui/score-ring';
import { ApiError, apiFetch } from '../lib/api/client';
import { riderTripDetailSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderTripDetail } from '../lib/types/api';
import type { RiderTripsStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type TripDetailScreenProps = NativeStackScreenProps<
  RiderTripsStackParamList,
  'TripDetail'
>;

function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'In progress';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface EventCountBarProps {
  label: string;
  icon: string;
  count: number;
  maxCount: number;
  color: string;
  bgColor: string;
}

function EventCountBar({ label, icon, count, maxCount, color, bgColor }: EventCountBarProps) {
  const widthPct = maxCount > 0 ? Math.max(8, (count / maxCount) * 100) : 0;
  return (
    <View style={styles.eventBarRow}>
      <View style={styles.eventBarLabel}>
        <Text style={styles.eventBarIcon}>{icon}</Text>
        <Text style={styles.eventBarText}>{label}</Text>
      </View>
      <View style={styles.eventBarTrack}>
        {count > 0 ? (
          <View
            style={[
              styles.eventBarFill,
              { width: `${widthPct}%`, backgroundColor: bgColor },
            ]}
          >
            <Text style={[styles.eventBarCount, { color }]}>{count}</Text>
          </View>
        ) : (
          <Text style={styles.eventBarZero}>0</Text>
        )}
      </View>
    </View>
  );
}

export function TripDetailScreen({ route }: TripDetailScreenProps) {
  const { tripId } = route.params;

  const tripDetailQuery = useQuery({
    queryKey: ['rider-trip-detail', tripId],
    queryFn: () =>
      apiFetch<RiderTripDetail>(`/rider/trips/${tripId}`, undefined, {
        schema: riderTripDetailSchema,
      }),
  });

  if (tripDetailQuery.isError) {
    logAppError('rider.trip_detail_failed', tripDetailQuery.error, {
      feature: 'trips',
      operation: 'detail',
      status:
        tripDetailQuery.error instanceof ApiError
          ? tripDetailQuery.error.status
          : undefined,
    });
  }

  const trip = tripDetailQuery.data;
  const harshEventTotal = trip
    ? trip.eventCounts.HARSH_BRAKE +
      trip.eventCounts.HARSH_ACCEL +
      trip.eventCounts.HARSH_CORNER
    : 0;
  const criticalTotal = trip
    ? trip.eventCounts.CRASH + trip.eventCounts.THEFT_SUSPECTED
    : 0;
  const maxEventCount = trip
    ? Math.max(
        trip.eventCounts.OVERSPEED,
        trip.eventCounts.HARSH_BRAKE,
        trip.eventCounts.HARSH_ACCEL,
        trip.eventCounts.HARSH_CORNER,
        trip.eventCounts.CRASH,
        1,
      )
    : 1;

  if (tripDetailQuery.isLoading && !trip) {
    return (
      <ScreenContainer>
        <SectionHeader title="Trip Detail" />
        <CardSkeleton />
        <ListSkeleton rows={3} />
      </ScreenContainer>
    );
  }

  if (tripDetailQuery.isError && !trip) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Unable to load trip detail"
          description="This trip could not be fetched right now."
          onRetry={() => {
            void tripDetailQuery.refetch();
          }}
        />
      </ScreenContainer>
    );
  }

  if (!trip) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Trip not available"
          description="The selected trip is missing or no longer accessible."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshing={tripDetailQuery.isRefetching}
      onRefresh={() => {
        void tripDetailQuery.refetch();
      }}
    >
      {/* Hero section with score ring */}
      <View style={styles.heroSection}>
        <View style={styles.heroDateRow}>
          <Text style={styles.heroDate}>{formatDate(trip.startTs)}</Text>
          <Badge label={trip.bikeLabel} tone="primary" />
        </View>
        <View style={styles.heroContent}>
          <ScoreRing score={trip.score} size={110} />
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>
                {trip.distanceKm.toFixed(1)}
              </Text>
              <Text style={styles.heroMetricUnit}>km</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>
                {formatDuration(trip.durationSec)}
              </Text>
              <Text style={styles.heroMetricUnit}>duration</Text>
            </View>
            {trip.consumptionPct !== null && (
              <>
                <View style={styles.heroMetricDivider} />
                <View style={styles.heroMetric}>
                  <Text style={[styles.heroMetricValue, { color: theme.colors.success }]}>
                    {trip.consumptionPct.toFixed(0)}%
                  </Text>
                  <Text style={styles.heroMetricUnit}>used</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Timeline card */}
      <View style={styles.timelineCard}>
        <View style={styles.timelineRow}>
          <View style={[styles.timelineDot, { backgroundColor: theme.colors.success }]} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineLabel}>Start</Text>
            <Text style={styles.timelineTime}>{formatTimestamp(trip.startTs)}</Text>
          </View>
        </View>
        <View style={styles.timelineConnector} />
        <View style={styles.timelineRow}>
          <View style={[styles.timelineDot, { backgroundColor: trip.endTs ? theme.colors.primary : theme.colors.warning }]} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineLabel}>End</Text>
            <Text style={styles.timelineTime}>{formatTimestamp(trip.endTs)}</Text>
          </View>
        </View>
      </View>

      {/* Event counts with visual bars */}
      <SectionHeader title="Events" subtitle="Penalties by type" />
      <View style={styles.eventsCard}>
        <EventCountBar
          label="Overspeed"
          icon="⚡"
          count={trip.eventCounts.OVERSPEED}
          maxCount={maxEventCount}
          color={theme.colors.warning}
          bgColor={theme.colors.warningSoft}
        />
        <EventCountBar
          label="Hard Brake"
          icon="🛑"
          count={trip.eventCounts.HARSH_BRAKE}
          maxCount={maxEventCount}
          color={theme.colors.danger}
          bgColor={theme.colors.dangerSoft}
        />
        <EventCountBar
          label="Hard Accel"
          icon="🏎️"
          count={trip.eventCounts.HARSH_ACCEL}
          maxCount={maxEventCount}
          color={theme.colors.primary}
          bgColor={theme.colors.primarySoft}
        />
        <EventCountBar
          label="Hard Corner"
          icon="↩️"
          count={trip.eventCounts.HARSH_CORNER}
          maxCount={maxEventCount}
          color={theme.colors.purple}
          bgColor={theme.colors.purpleSoft}
        />
        <EventCountBar
          label="Crash"
          icon="💥"
          count={trip.eventCounts.CRASH}
          maxCount={maxEventCount}
          color={theme.colors.danger}
          bgColor={theme.colors.dangerSoft}
        />

        {/* Summary row */}
        <View style={styles.eventSummaryRow}>
          <View style={styles.eventSummaryItem}>
            <Text style={styles.eventSummaryValue}>{harshEventTotal}</Text>
            <Text style={styles.eventSummaryLabel}>Harsh total</Text>
          </View>
          <View style={styles.eventSummaryItem}>
            <Text style={styles.eventSummaryValue}>{trip.eventCounts.OVERSPEED}</Text>
            <Text style={styles.eventSummaryLabel}>Overspeed</Text>
          </View>
          <View style={styles.eventSummaryItem}>
            <Text style={[styles.eventSummaryValue, criticalTotal > 0 ? { color: theme.colors.danger } : null]}>
              {criticalTotal}
            </Text>
            <Text style={styles.eventSummaryLabel}>Critical</Text>
          </View>
        </View>
      </View>

      {/* Score breakdown */}
      <SectionHeader title="Score Breakdown" subtitle="Penalty details" />
      <View style={styles.breakdownCard}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Total penalty</Text>
          <Text style={[styles.breakdownValue, { color: theme.colors.danger }]}>
            -{trip.scoreBreakdown.penalties.total.toFixed(2)}
          </Text>
        </View>
        <View style={styles.breakdownDivider} />
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Overspeed</Text>
          <Text style={styles.breakdownValue}>
            -{trip.scoreBreakdown.penalties.OVERSPEED.toFixed(2)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Harsh riding</Text>
          <Text style={styles.breakdownValue}>
            -{(
              trip.scoreBreakdown.penalties.HARSH_BRAKE +
              trip.scoreBreakdown.penalties.HARSH_ACCEL +
              trip.scoreBreakdown.penalties.HARSH_CORNER
            ).toFixed(2)}
          </Text>
        </View>
        <View style={styles.breakdownDivider} />
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Scored distance</Text>
          <Text style={styles.breakdownValue}>
            {trip.scoreBreakdown.normalizedDistanceKm.toFixed(2)} km
          </Text>
        </View>
      </View>

      {tripDetailQuery.isError ? (
        <ErrorState
          title="Some details may be stale"
          description="The latest refresh did not complete."
          retryLabel="Reload trip"
          onRetry={() => {
            void tripDetailQuery.refetch();
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.hero,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.lg,
    ...theme.shadow,
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroDate: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  heroMetrics: {
    flex: 1,
    gap: theme.spacing.lg,
  },
  heroMetric: {
    alignItems: 'center',
    gap: 2,
  },
  heroMetricValue: {
    fontSize: theme.typography.hero,
    fontWeight: '800',
    color: theme.colors.text,
  },
  heroMetricUnit: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroMetricDivider: {
    height: 1,
    backgroundColor: theme.colors.borderFaint,
    marginHorizontal: theme.spacing.lg,
  },
  timelineCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    ...theme.shadowLight,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineConnector: {
    width: 2,
    height: 20,
    backgroundColor: theme.colors.border,
    marginLeft: 5,
    marginVertical: theme.spacing.xs,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLabel: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  timelineTime: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  eventsCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.md,
    ...theme.shadowLight,
  },
  eventBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  eventBarLabel: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  eventBarIcon: {
    fontSize: 14,
  },
  eventBarText: {
    fontSize: theme.typography.small,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  eventBarTrack: {
    flex: 1,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  eventBarFill: {
    height: '100%',
    borderRadius: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  eventBarCount: {
    fontSize: theme.typography.small,
    fontWeight: '800',
  },
  eventBarZero: {
    fontSize: theme.typography.small,
    fontWeight: '600',
    color: theme.colors.textFaint,
    paddingLeft: theme.spacing.sm,
  },
  eventSummaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderFaint,
  },
  eventSummaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  eventSummaryValue: {
    fontSize: theme.typography.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
  },
  eventSummaryLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  breakdownCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.md,
    ...theme.shadowLight,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  breakdownValue: {
    fontSize: theme.typography.emphasis,
    fontWeight: '800',
    color: theme.colors.text,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: theme.colors.borderFaint,
  },
});
