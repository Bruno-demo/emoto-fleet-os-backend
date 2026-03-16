import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { ListItem } from '../components/ui/list-item';
import { ScoreBadge } from '../components/ui/badge';
import { SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ListSkeleton } from '../components/ui/skeleton';
import { ApiError, apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import { paginatedResponseSchema, riderTripSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { PaginatedResponse, RiderTripSummary } from '../lib/types/api';
import type { RiderTripsStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type TripsScreenProps = NativeStackScreenProps<
  RiderTripsStackParamList,
  'TripsList'
>;

const PAGE_SIZE = 10;

// Formats seconds into a compact duration label suitable for trip list rows.
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

// Formats a trip start timestamp into a concise local rider-facing label.
function formatTripDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Lists rider-scoped trips with clearer score, distance, and pagination controls.
export function TripsScreen({ navigation }: TripsScreenProps) {
  const [page, setPage] = useState(1);

  const tripsQuery = useQuery({
    queryKey: ['rider-trips', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<RiderTripSummary>>(
        `/rider/trips${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
        undefined,
        { schema: paginatedResponseSchema(riderTripSchema) },
      ),
  });

  if (tripsQuery.isError) {
    logAppError('rider.trips_list_failed', tripsQuery.error, {
      feature: 'trips',
      operation: 'list',
      status: tripsQuery.error instanceof ApiError ? tripsQuery.error.status : undefined,
    });
  }

  const payload = tripsQuery.data;
  const rows = payload?.data ?? [];
  const canGoPrevious = page > 1;
  const canGoNext = Boolean(payload && page < payload.totalPages);

  if (tripsQuery.isLoading && !payload) {
    return (
      <ScreenContainer>
        <SectionHeader
          title="Trips"
          subtitle="Loading your scored rides and recent summaries."
        />
        <ListSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  if (tripsQuery.isError && !payload) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Unable to load trips"
          description="Your rider trips could not be fetched right now. Pull to refresh or try again."
          onRetry={() => {
            void tripsQuery.refetch();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshing={tripsQuery.isRefetching}
      onRefresh={() => {
        void tripsQuery.refetch();
      }}
    >
      <SectionHeader
        title="Trips"
        subtitle="Review your recent rides, scores, and distance at a glance."
        rightSlot={<Text style={styles.totalLabel}>{payload?.total ?? 0} total</Text>}
      />

      <AppCard
        title="Ride history"
        subtitle="Open any trip to inspect score breakdown and harsh event counts."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No trips yet"
            description="Your scored trips will appear here after your first completed ride."
          />
        ) : (
          <View style={styles.listStack}>
            {rows.map((trip) => (
              <ListItem
                key={trip.id}
                title={`${trip.distanceKm.toFixed(1)} km trip`}
                subtitle={`Duration ${formatDuration(trip.durationSec)}`}
                meta={formatTripDate(trip.startTs)}
                rightSlot={<ScoreBadge score={trip.score} />}
                onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
              />
            ))}
          </View>
        )}
      </AppCard>

      <View style={styles.paginationCard}>
        <Text style={styles.pageLabel}>
          Page {payload?.page ?? page} of {payload?.totalPages ?? 1}
        </Text>
        <View style={styles.paginationActions}>
          <View style={styles.paginationButton}>
            <SecondaryButton
              label="Previous"
              disabled={!canGoPrevious}
              onPress={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            />
          </View>
          <View style={styles.paginationButton}>
            <SecondaryButton
              label="Next"
              disabled={!canGoNext}
              onPress={() =>
                setPage((currentPage) =>
                  payload ? Math.min(payload.totalPages, currentPage + 1) : currentPage + 1,
                )
              }
            />
          </View>
        </View>
      </View>

      {tripsQuery.isError ? (
        <ErrorState
          title="Trips may be incomplete"
          description="Some trip data could not be refreshed. Pull down or tap retry to request the latest page again."
          retryLabel="Reload trips"
          onRetry={() => {
            void tripsQuery.refetch();
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  totalLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listStack: {
    gap: theme.spacing.md,
  },
  paginationCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow,
  },
  pageLabel: {
    fontSize: theme.typography.body,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  paginationActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  paginationButton: {
    flex: 1,
  },
});
