import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/loading-state';
import { ScreenContainer } from '../components/screen-container';
import { ApiError, apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import {
  paginatedResponseSchema,
  riderEventSchema,
  riderTripSchema,
  riderWeeklyScoreSchema,
} from '../lib/api/schemas';
import { useAuth } from '../lib/auth/auth-context';
import { logAppError } from '../lib/monitoring/error-log';
import type {
  PaginatedResponse,
  RiderEventSummary,
  RiderTripSummary,
  RiderWeeklyScoreResponse,
} from '../lib/types/api';
import { z } from 'zod';

// Shows rider home insights including weekly score, latest trip, and recent alerts.
export function HomeScreen() {
  const auth = useAuth();

  const weeklyScoreQuery = useQuery({
    queryKey: ['rider-score', 'weekly'],
    queryFn: () =>
      apiFetch<RiderWeeklyScoreResponse>('/rider/score/weekly', undefined, {
        schema: riderWeeklyScoreSchema,
      }),
  });

  const latestTripQuery = useQuery({
    queryKey: ['rider-trip', 'latest'],
    queryFn: () =>
      apiFetch<PaginatedResponse<RiderTripSummary>>(
        `/rider/trips${buildQueryString({ page: 1, pageSize: 1 })}`,
        undefined,
        { schema: paginatedResponseSchema(riderTripSchema) },
      ),
  });

  const latestAlertQuery = useQuery({
    queryKey: ['rider-events', 'recent-alerts'],
    queryFn: () =>
      apiFetch<RiderEventSummary[]>(
        `/rider/events${buildQueryString({ limit: 5 })}`,
        undefined,
        { schema: z.array(riderEventSchema) },
      ),
  });

  // Refreshes rider profile and home cards in one pull-to-refresh action.
  const refreshAll = async (): Promise<void> => {
    await Promise.all([
      auth.refreshRiderMe(),
      weeklyScoreQuery.refetch(),
      latestTripQuery.refetch(),
      latestAlertQuery.refetch(),
    ]);
  };

  if (weeklyScoreQuery.isLoading || latestTripQuery.isLoading) {
    return <LoadingState message="Loading rider home..." />;
  }

  if (weeklyScoreQuery.isError) {
    logAppError('rider.home_weekly_score_failed', weeklyScoreQuery.error, {
      feature: 'home',
      operation: 'weeklyScore',
      status:
        weeklyScoreQuery.error instanceof ApiError
          ? weeklyScoreQuery.error.status
          : undefined,
    });
  }

  if (latestTripQuery.isError) {
    logAppError('rider.home_latest_trip_failed', latestTripQuery.error, {
      feature: 'home',
      operation: 'latestTrip',
      status:
        latestTripQuery.error instanceof ApiError
          ? latestTripQuery.error.status
          : undefined,
    });
  }

  if (latestAlertQuery.isError) {
    logAppError('rider.home_recent_events_failed', latestAlertQuery.error, {
      feature: 'home',
      operation: 'recentEvents',
      status:
        latestAlertQuery.error instanceof ApiError
          ? latestAlertQuery.error.status
          : undefined,
    });
  }

  const weeklyScore = weeklyScoreQuery.data;
  const latestTrip = latestTripQuery.data?.data[0] ?? null;
  const recentAlerts = latestAlertQuery.data ?? [];
  const assignmentCount = auth.riderMe?.assignments.length ?? 0;

  return (
    <ScreenContainer
      refreshing={
        weeklyScoreQuery.isRefetching ||
        latestTripQuery.isRefetching ||
        latestAlertQuery.isRefetching
      }
      onRefresh={() => void refreshAll()}
    >
      <Text style={styles.pageTitle}>Rider Home</Text>
      <Text style={styles.pageSubtitle}>
        {auth.riderMe?.fullName ?? 'Rider'} | Fleet{' '}
        {auth.riderMe?.fleetId.slice(0, 8) ?? '--'}
      </Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Weekly Score</Text>
          <Text style={styles.cardValue}>
            {(weeklyScore?.avgScore ?? 0).toFixed(1)}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Trips (Week)</Text>
          <Text style={styles.cardValue}>{weeklyScore?.tripCount ?? 0}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Best Score</Text>
          <Text style={styles.cardValue}>{weeklyScore?.bestScore ?? '--'}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Assigned Bikes</Text>
          <Text style={styles.cardValue}>{assignmentCount}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Trip</Text>
        {latestTrip ? (
          <>
            <Text style={styles.sectionText}>
              Score: {latestTrip.score.toFixed(1)}
            </Text>
            <Text style={styles.sectionText}>
              Distance: {latestTrip.distanceKm.toFixed(2)} km
            </Text>
            <Text style={styles.sectionText}>
              {new Date(latestTrip.startTs).toLocaleString()}
            </Text>
          </>
        ) : (
          <Text style={styles.sectionText}>No trips yet.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Alerts</Text>
        {recentAlerts.length > 0 ? (
          recentAlerts.map((event) => (
            <View key={event.id} style={styles.alertRow}>
              <Text style={styles.alertType}>{event.type}</Text>
              <Text style={styles.alertMeta}>
                {event.severity} | {new Date(event.ts).toLocaleString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.sectionText}>No recent alerts.</Text>
        )}
      </View>

      <Pressable style={styles.logoutButton} onPress={() => void auth.logout()}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  grid: {
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  cardLabel: {
    fontSize: 13,
    color: '#4b5563',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
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
  alertRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  alertType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  alertMeta: {
    fontSize: 12,
    color: '#4b5563',
  },
  logoutButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d7de',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
});
