import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { Badge, ScoreBadge } from '../components/ui/badge';
import { SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ListSkeleton } from '../components/ui/skeleton';
import { ApiError, apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import { paginatedResponseSchema, riderTripSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { PaginatedResponse, RiderTripSummary } from '../lib/types/api';
import type { RiderTripsStackParamList } from '../navigation/navigation.types';
import { getScoreTone, theme } from '../theme/tokens';

type TripsScreenProps = NativeStackScreenProps<
  RiderTripsStackParamList,
  'TripsList'
>;

const PAGE_SIZE = 10;

function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatTripDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

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
        <SectionHeader title="Trips" subtitle="Loading your scored rides..." />
        <ListSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  if (tripsQuery.isError && !payload) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Unable to load trips"
          description="Pull to refresh or try again."
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
        subtitle="Your scored rides at a glance"
        rightSlot={
          <Badge label={`${payload?.total ?? 0} total`} tone="primary" />
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Your scored trips will appear here after your first ride."
        />
      ) : (
        <View style={styles.tripsList}>
          {rows.map((trip, index) => {
            const scoreTone = getScoreTone(trip.score);
            return (
              <Pressable
                key={trip.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
                style={({ pressed }) => [
                  styles.tripCard,
                  pressed ? styles.tripCardPressed : null,
                  index === rows.length - 1 ? styles.tripCardLast : null,
                ]}
              >
                {/* Score circle */}
                <View style={[styles.tripScoreCircle, { borderColor: scoreTone.border, backgroundColor: scoreTone.background }]}>
                  <Text style={[styles.tripScoreText, { color: scoreTone.text }]}>
                    {trip.score?.toFixed(0) ?? '--'}
                  </Text>
                </View>

                {/* Trip info */}
                <View style={styles.tripInfo}>
                  <View style={styles.tripTopRow}>
                    <Text style={styles.tripDistance}>
                      {trip.distanceKm.toFixed(1)} km
                    </Text>
                    <Text style={styles.tripDuration}>
                      {formatDuration(trip.durationSec)}
                    </Text>
                  </View>
                  <Text style={styles.tripDate}>
                    {formatShortDate(trip.startTs)} · {formatTripDate(trip.startTs)}
                  </Text>
                </View>

                {/* Chevron */}
                <Text style={styles.tripChevron}>›</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Pagination */}
      {(payload?.totalPages ?? 1) > 1 ? (
        <View style={styles.paginationCard}>
          <Text style={styles.pageLabel}>
            Page {payload?.page ?? page} of {payload?.totalPages ?? 1}
          </Text>
          <View style={styles.paginationActions}>
            <View style={styles.paginationButton}>
              <SecondaryButton
                label="Previous"
                disabled={!canGoPrevious}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              />
            </View>
            <View style={styles.paginationButton}>
              <SecondaryButton
                label="Next"
                disabled={!canGoNext}
                onPress={() =>
                  setPage((p) =>
                    payload ? Math.min(payload.totalPages, p + 1) : p + 1,
                  )
                }
              />
            </View>
          </View>
        </View>
      ) : null}

      {tripsQuery.isError ? (
        <ErrorState
          title="Trips may be incomplete"
          description="Some data could not be refreshed."
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
  tripsList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadow,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.cardPadding,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderFaint,
  },
  tripCardPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  tripCardLast: {
    borderBottomWidth: 0,
  },
  tripScoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripScoreText: {
    fontSize: theme.typography.emphasis,
    fontWeight: '800',
  },
  tripInfo: {
    flex: 1,
    gap: 3,
  },
  tripTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  tripDistance: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tripDuration: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tripDate: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  tripChevron: {
    fontSize: 22,
    fontWeight: '300',
    color: theme.colors.textMuted,
  },
  paginationCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadowLight,
  },
  pageLabel: {
    fontSize: theme.typography.body,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  paginationActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  paginationButton: {
    flex: 1,
  },
});
