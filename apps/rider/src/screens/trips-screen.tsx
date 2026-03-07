import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/loading-state';
import { ScreenContainer } from '../components/screen-container';
import { apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import { paginatedResponseSchema, riderTripSchema } from '../lib/api/schemas';
import type { PaginatedResponse, RiderTripSummary } from '../lib/types/api';
import type { RiderTripsStackParamList } from '../navigation/navigation.types';

type TripsScreenProps = NativeStackScreenProps<
  RiderTripsStackParamList,
  'TripsList'
>;

const PAGE_SIZE = 10;

// Formats seconds into a compact human-readable minutes/seconds label.
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${mins}m ${remainingSeconds}s`;
}

// Lists rider-scoped trips with pagination and navigation to detail view.
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

  if (tripsQuery.isLoading) {
    return <LoadingState message="Loading your trips..." />;
  }

  const payload = tripsQuery.data;
  const rows = payload?.data ?? [];
  const canGoPrevious = page > 1;
  const canGoNext = Boolean(payload && page < payload.totalPages);

  return (
    <ScreenContainer
      refreshing={tripsQuery.isRefetching}
      onRefresh={() => void tripsQuery.refetch()}
    >
      <Text style={styles.title}>Trips</Text>
      <Text style={styles.subtitle}>
        Rider-scoped trips only. Total: {payload?.total ?? 0}
      </Text>

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No trips yet.</Text>
      ) : (
        rows.map((trip) => (
          <Pressable
            key={trip.id}
            onPress={() => navigation.navigate('TripDetail', { trip })}
            style={styles.tripCard}
          >
            <Text style={styles.tripTitle}>
              Bike {trip.bikeId.slice(0, 8)} | Score {trip.score.toFixed(1)}
            </Text>
            <Text style={styles.tripMeta}>
              Distance {trip.distanceKm.toFixed(2)} km
            </Text>
            <Text style={styles.tripMeta}>
              Duration {formatDuration(trip.durationSec)}
            </Text>
            <Text style={styles.tripMeta}>
              {new Date(trip.startTs).toLocaleString()}
            </Text>
          </Pressable>
        ))
      )}

      <View style={styles.pagination}>
        <Pressable
          disabled={!canGoPrevious}
          onPress={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          style={[styles.pageButton, !canGoPrevious ? styles.pageButtonDisabled : null]}
        >
          <Text style={styles.pageButtonText}>Previous</Text>
        </Pressable>
        <Text style={styles.pageLabel}>
          Page {payload?.page ?? page} / {payload?.totalPages ?? 1}
        </Text>
        <Pressable
          disabled={!canGoNext}
          onPress={() =>
            setPage((currentPage) =>
              payload ? Math.min(payload.totalPages, currentPage + 1) : currentPage + 1,
            )
          }
          style={[styles.pageButton, !canGoNext ? styles.pageButtonDisabled : null]}
        >
          <Text style={styles.pageButtonText}>Next</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  emptyText: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 16,
    color: '#4b5563',
  },
  tripCard: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  tripMeta: {
    fontSize: 13,
    color: '#374151',
  },
  pagination: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pageButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d7de',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  pageLabel: {
    fontSize: 13,
    color: '#4b5563',
  },
});
