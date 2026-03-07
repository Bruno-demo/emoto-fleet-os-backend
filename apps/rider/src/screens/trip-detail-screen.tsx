import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/loading-state';
import { ScreenContainer } from '../components/screen-container';
import { ApiError, apiFetch } from '../lib/api/client';
import { riderTripDetailSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderTripDetail } from '../lib/types/api';
import type { RiderTripsStackParamList } from '../navigation/navigation.types';

type TripDetailScreenProps = NativeStackScreenProps<
  RiderTripsStackParamList,
  'TripDetail'
>;

// Formats duration seconds into readable minutes/seconds for trip details.
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Loads rider-owned trip details with score breakdown and event count diagnostics.
export function TripDetailScreen({ route }: TripDetailScreenProps) {
  const { tripId } = route.params;

  const tripDetailQuery = useQuery({
    queryKey: ['rider-trip-detail', tripId],
    queryFn: () =>
      apiFetch<RiderTripDetail>(`/rider/trips/${tripId}`, undefined, {
        schema: riderTripDetailSchema,
      }),
  });

  if (tripDetailQuery.isLoading) {
    return <LoadingState message="Loading trip details..." />;
  }

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
  if (!trip) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Trip Detail</Text>
        <Text style={styles.errorText}>
          Unable to load trip details right now.
        </Text>
      </ScreenContainer>
    );
  }

  const harshEventTotal =
    trip.eventCounts.HARSH_BRAKE +
    trip.eventCounts.HARSH_ACCEL +
    trip.eventCounts.HARSH_CORNER;

  return (
    <ScreenContainer
      refreshing={tripDetailQuery.isRefetching}
      onRefresh={() => void tripDetailQuery.refetch()}
    >
      <Text style={styles.title}>Trip Detail</Text>
      <Text style={styles.subtitle}>Trip {trip.id.slice(0, 8)}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Bike</Text>
        <Text style={styles.value}>{trip.bikeId}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Start</Text>
        <Text style={styles.value}>{new Date(trip.startTs).toLocaleString()}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>End</Text>
        <Text style={styles.value}>
          {trip.endTs ? new Date(trip.endTs).toLocaleString() : 'In progress'}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>{trip.distanceKm.toFixed(2)} km</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Duration</Text>
          <Text style={styles.metricValue}>{formatDuration(trip.durationSec)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Score</Text>
          <Text style={styles.metricValue}>{trip.score.toFixed(1)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Event Counts</Text>
        <Text style={styles.sectionText}>
          Harsh events: {harshEventTotal} (Brake {trip.eventCounts.HARSH_BRAKE},
          Accel {trip.eventCounts.HARSH_ACCEL}, Corner{' '}
          {trip.eventCounts.HARSH_CORNER})
        </Text>
        <Text style={styles.sectionText}>
          Overspeed events: {trip.eventCounts.OVERSPEED}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        <Text style={styles.sectionText}>
          Total penalty: {trip.scoreBreakdown.penalties.total.toFixed(2)}
        </Text>
        <Text style={styles.sectionText}>
          Overspeed penalty:{' '}
          {trip.scoreBreakdown.penalties.OVERSPEED.toFixed(2)}
        </Text>
        <Text style={styles.sectionText}>
          Harsh penalty:{' '}
          {(
            trip.scoreBreakdown.penalties.HARSH_BRAKE +
            trip.scoreBreakdown.penalties.HARSH_ACCEL +
            trip.scoreBreakdown.penalties.HARSH_CORNER
          ).toFixed(2)}
        </Text>
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
  card: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  grid: {
    gap: 10,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#4b5563',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionText: {
    fontSize: 14,
    color: '#374151',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
});
