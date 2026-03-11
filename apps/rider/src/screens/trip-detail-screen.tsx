import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { Badge, ScoreBadge } from '../components/ui/badge';
import { ListItem } from '../components/ui/list-item';
import { SectionHeader } from '../components/ui/section-header';
import { CardSkeleton, ListSkeleton } from '../components/ui/skeleton';
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

// Formats duration seconds into a short label for trip summary cards.
function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${totalMinutes} min`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

// Formats timestamps into concise trip timeline entries.
function formatTimestamp(iso: string | null): string {
  if (!iso) {
    return 'In progress';
  }

  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Loads rider-owned trip details with clearer scoring and event diagnostics.
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

  if (tripDetailQuery.isLoading && !trip) {
    return (
      <ScreenContainer>
        <SectionHeader title="Trip detail" subtitle="Loading score breakdown and event counts." />
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
          description="This trip could not be fetched right now. Try again or return to the list and refresh."
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
          description="The selected trip is missing or no longer accessible from this rider account."
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
      <SectionHeader
        title="Trip detail"
        subtitle="See how event counts affected your score on this ride."
        rightSlot={<ScoreBadge score={trip.score} />}
      />

      <AppCard title="Trip summary" subtitle="A clean ride lowers harsh event penalties and raises your weekly score.">
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{trip.distanceKm.toFixed(1)} km</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{formatDuration(trip.durationSec)}</Text>
          </View>
        </View>
        <View style={styles.badgeRow}>
          <Badge label={`Bike ${trip.bikeId.slice(0, 8)}`} />
          <Badge label={`Started ${formatTimestamp(trip.startTs)}`} tone="primary" />
        </View>
      </AppCard>

      <AppCard title="Timeline" subtitle="Trip start and end times are shown in your local time zone.">
        <View style={styles.stack}>
          <ListItem title="Start" meta={formatTimestamp(trip.startTs)} />
          <ListItem title="End" meta={formatTimestamp(trip.endTs)} />
        </View>
      </AppCard>

      <AppCard title="Event counts" subtitle="Harsh riding and overspeed events contribute directly to score penalties.">
        <View style={styles.stack}>
          <ListItem
            title="Harsh riding"
            subtitle={`Brake ${trip.eventCounts.HARSH_BRAKE} | Accel ${trip.eventCounts.HARSH_ACCEL} | Corner ${trip.eventCounts.HARSH_CORNER}`}
            rightSlot={<Badge label={`${harshEventTotal} total`} tone={harshEventTotal > 0 ? 'warning' : 'success'} />}
          />
          <ListItem
            title="Overspeed"
            subtitle="Triggered when you exceed allowed speed thresholds."
            rightSlot={<Badge label={`${trip.eventCounts.OVERSPEED}`} tone={trip.eventCounts.OVERSPEED > 0 ? 'warning' : 'success'} />}
          />
          <ListItem
            title="Critical incidents"
            subtitle="Crash and theft suspected events carry the heaviest penalties."
            rightSlot={
              <Badge
                label={`${trip.eventCounts.CRASH + trip.eventCounts.THEFT_SUSPECTED}`}
                tone={trip.eventCounts.CRASH + trip.eventCounts.THEFT_SUSPECTED > 0 ? 'danger' : 'success'}
              />
            }
          />
        </View>
      </AppCard>

      <AppCard title="Score breakdown" subtitle="These penalties were applied over your normalized trip distance.">
        <View style={styles.stack}>
          <ListItem
            title="Total penalty"
            meta={trip.scoreBreakdown.penalties.total.toFixed(2)}
          />
          <ListItem
            title="Overspeed penalty"
            meta={trip.scoreBreakdown.penalties.OVERSPEED.toFixed(2)}
          />
          <ListItem
            title="Harsh riding penalty"
            meta={(
              trip.scoreBreakdown.penalties.HARSH_BRAKE +
              trip.scoreBreakdown.penalties.HARSH_ACCEL +
              trip.scoreBreakdown.penalties.HARSH_CORNER
            ).toFixed(2)}
          />
          <ListItem
            title="Distance used for scoring"
            meta={`${trip.scoreBreakdown.normalizedDistanceKm.toFixed(2)} km`}
          />
        </View>
      </AppCard>

      {tripDetailQuery.isError ? (
        <ErrorState
          title="Some trip details may be stale"
          description="The trip summary is visible, but the latest server refresh did not complete."
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
  metricRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  metricLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  stack: {
    gap: theme.spacing.md,
  },
});
