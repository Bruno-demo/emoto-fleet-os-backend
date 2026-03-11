import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { Badge, ScoreBadge, SeverityBadge } from '../components/ui/badge';
import { ListItem } from '../components/ui/list-item';
import { SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { CardSkeleton, ListSkeleton, SkeletonBlock } from '../components/ui/skeleton';
import { ScoreRing } from '../components/ui/score-ring';
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
import { getScoreTone, theme } from '../theme/tokens';
import { z } from 'zod';

interface CoachingTip {
  title: string;
  detail: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
}

// Formats trip durations into short, rider-readable text.
function formatDuration(durationSec: number): string {
  const totalMinutes = Math.max(1, Math.round(durationSec / 60));
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

// Formats timestamps into concise local rider-friendly labels.
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Builds short coaching guidance from weekly score, latest trip, and recent alerts.
function buildCoachingTips(
  weeklyScore: RiderWeeklyScoreResponse | undefined,
  latestTrip: RiderTripSummary | null,
  recentAlerts: RiderEventSummary[],
): CoachingTip[] {
  const tips: CoachingTip[] = [];

  if (recentAlerts.some((event) => event.type === 'OVERSPEED')) {
    tips.push({
      title: 'Ease off in slow zones',
      detail: 'One recent overspeed alert was recorded. Holding a steadier pace will protect your score.',
      tone: 'warning',
    });
  }

  if (
    recentAlerts.some(
      (event) => event.type === 'HARSH_BRAKE' || event.type === 'HARSH_ACCEL',
    )
  ) {
    tips.push({
      title: 'Smooth your braking and throttle',
      detail: 'Leave a little more room ahead so you can brake and accelerate progressively.',
      tone: 'primary',
    });
  }

  if ((weeklyScore?.avgScore ?? 0) >= 85) {
    tips.push({
      title: 'Keep the streak going',
      detail: 'Your weekly score is strong. Focus on another clean trip to hold the lead.',
      tone: 'success',
    });
  }

  if (!latestTrip) {
    tips.push({
      title: 'Start with one calm trip',
      detail: 'Your first scored ride will unlock personalized coaching and trend tracking.',
      tone: 'primary',
    });
  } else if (latestTrip.distanceKm < 5) {
    tips.push({
      title: 'Build a steadier sample',
      detail: 'A slightly longer smooth ride gives the app better data for your weekly score.',
      tone: 'primary',
    });
  }

  if (tips.length < 2) {
    tips.push({
      title: 'Check your assigned bike before departure',
      detail: 'A quick tire, brake, and battery check reduces avoidable harsh events later on the route.',
      tone: 'primary',
    });
  }

  return tips.slice(0, 2);
}

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
  const activeAssignment = auth.riderMe?.assignments.find((assignment) => assignment.active) ?? null;
  const scoreTone = getScoreTone(weeklyScore?.avgScore);
  const coachingTips = buildCoachingTips(weeklyScore, latestTrip, recentAlerts);

  if (
    (weeklyScoreQuery.isLoading && !weeklyScore) ||
    (latestTripQuery.isLoading && !latestTripQuery.data)
  ) {
    return (
      <ScreenContainer>
        <SectionHeader
          title="Rider Home"
          subtitle="Loading your weekly score, recent trip, and coaching tips."
        />
        <AppCard>
          <View style={styles.scoreSkeleton}>
            <SkeletonBlock height={120} width={120} radius={60} />
            <View style={styles.scoreSkeletonText}>
              <SkeletonBlock height={18} width="48%" />
              <SkeletonBlock height={14} width="72%" />
              <SkeletonBlock height={14} width="58%" />
            </View>
          </View>
        </AppCard>
        <CardSkeleton />
        <ListSkeleton rows={3} />
      </ScreenContainer>
    );
  }

  if (weeklyScoreQuery.isError && !weeklyScore) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Unable to load rider home"
          description="We could not fetch your weekly score right now. Pull to refresh or try again."
          onRetry={() => {
            void refreshAll();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshing={
        weeklyScoreQuery.isRefetching ||
        latestTripQuery.isRefetching ||
        latestAlertQuery.isRefetching
      }
      onRefresh={() => void refreshAll()}
    >
      <SectionHeader
        title={`Hi ${auth.riderMe?.fullName ?? 'Rider'}`}
        subtitle="Stay smooth, watch your score, and act fast if something looks wrong."
        rightSlot={<Badge label={scoreTone.label} tone={scoreTone.badgeTone} />}
      />

      <AppCard
        title="Weekly score"
        subtitle="A smoother week keeps your score high and your risk low."
      >
        <View style={styles.scoreHero}>
          <ScoreRing score={weeklyScore?.avgScore ?? null} />
          <View style={styles.scoreSummary}>
            <Text style={styles.scoreHeadline}>
              {scoreTone.label}
            </Text>
            <Text style={styles.scoreBody}>
              {weeklyScore?.tripCount ?? 0} trips logged this week.
            </Text>
            <View style={styles.metricRow}>
              <Badge
                label={`Best ${weeklyScore?.bestScore?.toFixed(1) ?? '--'}`}
                tone="success"
              />
              <Badge
                label={`Worst ${weeklyScore?.worstScore?.toFixed(1) ?? '--'}`}
                tone="warning"
              />
            </View>
          </View>
        </View>
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatLabel}>Assigned bikes</Text>
            <Text style={styles.quickStatValue}>{assignmentCount}</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatLabel}>Primary bike</Text>
            <Text style={styles.quickStatValue}>
              {activeAssignment?.bikeLabel ?? 'Not assigned'}
            </Text>
          </View>
        </View>
      </AppCard>

      <AppCard
        title="Last trip"
        subtitle="Your latest ride summary appears here as soon as scoring completes."
        rightSlot={<ScoreBadge score={latestTrip?.score ?? null} />}
      >
        {latestTrip ? (
          <View style={styles.summaryStack}>
            <ListItem
              title={`${latestTrip.distanceKm.toFixed(1)} km ride`}
              subtitle={`Duration ${formatDuration(latestTrip.durationSec)}`}
              meta={`Started ${formatTimestamp(latestTrip.startTs)}`}
            />
          </View>
        ) : (
          <EmptyState
            title="No trips yet"
            description="Take your first ride with the app connected to see score trends and coaching."
          />
        )}
      </AppCard>

      <AppCard title="Coaching tips" subtitle="Two quick actions to keep you safer this week.">
        <View style={styles.summaryStack}>
          {coachingTips.map((tip) => (
            <ListItem
              key={tip.title}
              title={tip.title}
              subtitle={tip.detail}
              leftSlot={<Badge label="Tip" tone={tip.tone} />}
            />
          ))}
        </View>
      </AppCard>

      <AppCard title="Recent alerts" subtitle="The latest events from your assigned bike help explain score changes.">
        {latestAlertQuery.isLoading ? (
          <ListSkeleton rows={3} />
        ) : recentAlerts.length > 0 ? (
          <View style={styles.summaryStack}>
            {recentAlerts.map((event) => (
              <ListItem
                key={event.id}
                title={event.type.replaceAll('_', ' ')}
                subtitle={`Bike ${event.bikeId ? event.bikeId.slice(0, 8) : 'unassigned'}`}
                meta={formatTimestamp(event.ts)}
                rightSlot={<SeverityBadge severity={event.severity} />}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No recent alerts"
            description="Clean riding keeps this feed quiet. New overspeed, harsh riding, crash, theft, or SOS events will appear here."
          />
        )}

        {latestAlertQuery.isError ? (
          <ErrorState
            title="Recent alerts are unavailable"
            description="The rest of your home screen is ready, but alerts could not be refreshed just now."
            retryLabel="Reload alerts"
            onRetry={() => {
              void latestAlertQuery.refetch();
            }}
          />
        ) : null}
      </AppCard>

      <View style={styles.logoutWrap}>
        <SecondaryButton label="Sign out" onPress={() => void auth.logout()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  scoreSummary: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  scoreHeadline: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
  },
  scoreBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickStats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  quickStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  quickStatLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickStatValue: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  summaryStack: {
    gap: theme.spacing.md,
  },
  logoutWrap: {
    paddingBottom: theme.spacing.xl,
  },
  scoreSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  scoreSkeletonText: {
    flex: 1,
    gap: theme.spacing.md,
  },
});
