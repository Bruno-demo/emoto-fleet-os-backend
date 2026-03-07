import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/loading-state';
import { ScreenContainer } from '../components/screen-container';
import { apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import { riderWeeklyScoreSchema } from '../lib/api/schemas';
import { useAuth } from '../lib/auth/auth-context';
import type { RiderWeeklyScoreResponse } from '../lib/types/api';

// Builds an ISO range for the current day in UTC for today-specific score snapshot.
function getTodayRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

// Shows rider score snapshots and quick account stats for the home tab.
export function HomeScreen() {
  const auth = useAuth();
  const todayRange = getTodayRange();

  const todayScoreQuery = useQuery({
    queryKey: ['rider-score', 'today', todayRange.from, todayRange.to],
    queryFn: () =>
      apiFetch<RiderWeeklyScoreResponse>(
        `/rider/score/weekly${buildQueryString({
          from: todayRange.from,
          to: todayRange.to,
        })}`,
        undefined,
        { schema: riderWeeklyScoreSchema },
      ),
  });

  const weeklyScoreQuery = useQuery({
    queryKey: ['rider-score', 'weekly'],
    queryFn: () =>
      apiFetch<RiderWeeklyScoreResponse>('/rider/score/weekly', undefined, {
        schema: riderWeeklyScoreSchema,
      }),
  });

  // Refreshes rider profile and score cards together from pull-to-refresh.
  const refreshAll = async (): Promise<void> => {
    await Promise.all([
      auth.refreshRiderMe(),
      todayScoreQuery.refetch(),
      weeklyScoreQuery.refetch(),
    ]);
  };

  if (todayScoreQuery.isLoading || weeklyScoreQuery.isLoading) {
    return <LoadingState message="Loading rider stats..." />;
  }

  const todayScore = todayScoreQuery.data?.avgScore ?? 0;
  const weeklyScore = weeklyScoreQuery.data;
  const assignmentCount = auth.riderMe?.assignments.length ?? 0;

  return (
    <ScreenContainer
      refreshing={todayScoreQuery.isRefetching || weeklyScoreQuery.isRefetching}
      onRefresh={() => void refreshAll()}
    >
      <Text style={styles.pageTitle}>Rider Home</Text>
      <Text style={styles.pageSubtitle}>
        {auth.riderMe?.fullName ?? 'Rider'} | Fleet{' '}
        {auth.riderMe?.fleetId.slice(0, 8) ?? '--'}
      </Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today Score</Text>
          <Text style={styles.cardValue}>{todayScore.toFixed(1)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Weekly Avg</Text>
          <Text style={styles.cardValue}>
            {(weeklyScore?.avgScore ?? 0).toFixed(1)}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Trips (Week)</Text>
          <Text style={styles.cardValue}>{weeklyScore?.tripCount ?? 0}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Assigned Bikes</Text>
          <Text style={styles.cardValue}>{assignmentCount}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <Text style={styles.sectionText}>
          Best weekly score: {weeklyScore?.bestScore ?? '--'}
        </Text>
        <Text style={styles.sectionText}>
          Worst weekly score: {weeklyScore?.worstScore ?? '--'}
        </Text>
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
