import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
}

function formatDuration(durationSec: number): string {
  const totalMinutes = Math.max(1, Math.round(durationSec / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getEventIcon(type: string): string {
  if (type === 'OVERSPEED') return '⚡';
  if (type === 'HARSH_BRAKE') return '🛑';
  if (type === 'HARSH_ACCEL') return '🏎️';
  if (type === 'HARSH_CORNER') return '↩️';
  if (type === 'CRASH') return '💥';
  if (type === 'THEFT_SUSPECTED') return '🔒';
  if (type === 'SOS') return '🆘';
  return '📍';
}

function buildCoachingTips(
  weeklyScore: RiderWeeklyScoreResponse | undefined,
  latestTrip: RiderTripSummary | null,
  recentAlerts: RiderEventSummary[],
): CoachingTip[] {
  const tips: CoachingTip[] = [];

  if (recentAlerts.some((event) => event.type === 'OVERSPEED')) {
    tips.push({
      title: 'Ease off in slow zones',
      detail: 'Recent overspeed detected. A steadier pace protects your score.',
      icon: '⚡',
      tone: 'warning',
    });
  }

  if (
    recentAlerts.some(
      (event) => event.type === 'HARSH_BRAKE' || event.type === 'HARSH_ACCEL',
    )
  ) {
    tips.push({
      title: 'Smooth your braking',
      detail: 'Leave more room ahead to brake and accelerate progressively.',
      icon: '🎯',
      tone: 'primary',
    });
  }

  if ((weeklyScore?.avgScore ?? 0) >= 85) {
    tips.push({
      title: 'Keep momentum',
      detail: 'Strong week! One more clean ride to hold the lead.',
      icon: '🏆',
      tone: 'success',
    });
  }

  if (!latestTrip) {
    tips.push({
      title: 'Start your first ride',
      detail: 'Your first scored ride unlocks coaching and trends.',
      icon: '🚀',
      tone: 'primary',
    });
  } else if (latestTrip.distanceKm < 5) {
    tips.push({
      title: 'Ride a bit longer',
      detail: 'A longer smooth ride gives better data for your score.',
      icon: '📏',
      tone: 'primary',
    });
  }

  if (tips.length < 2) {
    tips.push({
      title: 'Pre-ride check',
      detail: 'Quick tire, brake & battery check saves events later.',
      icon: '🔧',
      tone: 'primary',
    });
  }

  return tips.slice(0, 3);
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
  const firstName = (auth.riderMe?.fullName ?? 'Rider').split(' ')[0];

  if (
    (weeklyScoreQuery.isLoading && !weeklyScore) ||
    (latestTripQuery.isLoading && !latestTripQuery.data)
  ) {
    return (
      <ScreenContainer>
        <View style={styles.greetingSection}>
          <SkeletonBlock height={28} width="55%" />
          <SkeletonBlock height={16} width="70%" />
        </View>
        <AppCard>
          <View style={styles.scoreSkeleton}>
            <SkeletonBlock height={130} width={130} radius={65} />
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
      {/* Greeting banner */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.greetingText}>
            <Text style={styles.greetingName}>Hi, {firstName}</Text>
            <Text style={styles.greetingSubtitle}>
              {weeklyScore?.tripCount
                ? `${weeklyScore.tripCount} rides this week`
                : 'Stay smooth, ride safe'}
            </Text>
          </View>
          <Badge label={scoreTone.label} tone={scoreTone.badgeTone} />
        </View>
      </View>

      {/* Score hero card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreCardInner}>
          <ScoreRing score={weeklyScore?.avgScore ?? null} size={130} />
          <View style={styles.scoreSummary}>
            <Text style={styles.scoreCardTitle}>Weekly Score</Text>
            <Text style={styles.scoreHeadline}>{scoreTone.label}</Text>
            <Text style={styles.scoreBody}>
              {weeklyScore?.tripCount ?? 0} trips scored this week
            </Text>
            <View style={styles.bestWorstRow}>
              <View style={[styles.miniStat, { borderColor: theme.colors.successBorder, backgroundColor: theme.colors.successSoft }]}>
                <Text style={[styles.miniStatValue, { color: theme.colors.success }]}>
                  {weeklyScore?.bestScore?.toFixed(0) ?? '--'}
                </Text>
                <Text style={styles.miniStatLabel}>Best</Text>
              </View>
              <View style={[styles.miniStat, { borderColor: theme.colors.warningBorder, backgroundColor: theme.colors.warningSoft }]}>
                <Text style={[styles.miniStatValue, { color: theme.colors.warning }]}>
                  {weeklyScore?.worstScore?.toFixed(0) ?? '--'}
                </Text>
                <Text style={styles.miniStatLabel}>Worst</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Quick stats row */}
      <View style={styles.quickStatsRow}>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>🏍️</Text>
          <Text style={styles.quickStatValue}>{assignmentCount}</Text>
          <Text style={styles.quickStatLabel}>Bikes</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>📍</Text>
          <Text style={styles.quickStatValue} numberOfLines={1}>
            {activeAssignment?.bikeLabel ?? '—'}
          </Text>
          <Text style={styles.quickStatLabel}>Primary</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>⚠️</Text>
          <Text style={styles.quickStatValue}>{recentAlerts.length}</Text>
          <Text style={styles.quickStatLabel}>Alerts</Text>
        </View>
      </View>

      {/* Last trip card */}
      <AppCard
        title="Last Trip"
        rightSlot={<ScoreBadge score={latestTrip?.score ?? null} />}
      >
        {latestTrip ? (
          <View style={styles.lastTripContent}>
            <View style={styles.tripMetrics}>
              <View style={styles.tripMetric}>
                <Text style={styles.tripMetricValue}>
                  {latestTrip.distanceKm.toFixed(1)}
                </Text>
                <Text style={styles.tripMetricUnit}>km</Text>
              </View>
              <View style={styles.tripMetricDivider} />
              <View style={styles.tripMetric}>
                <Text style={styles.tripMetricValue}>
                  {formatDuration(latestTrip.durationSec)}
                </Text>
                <Text style={styles.tripMetricUnit}>duration</Text>
              </View>
            </View>
            <Text style={styles.tripTimestamp}>
              Started {formatTimestamp(latestTrip.startTs)}
            </Text>
          </View>
        ) : (
          <EmptyState
            title="No trips yet"
            description="Your first ride will unlock scoring and coaching."
          />
        )}
      </AppCard>

      {/* Coaching tips */}
      <SectionHeader title="Coaching" subtitle="Quick actions for a safer week" />
      <View style={styles.tipsGrid}>
        {coachingTips.map((tip) => {
          const toneColor =
            tip.tone === 'success'
              ? theme.colors.success
              : tip.tone === 'warning'
                ? theme.colors.warning
                : tip.tone === 'danger'
                  ? theme.colors.danger
                  : theme.colors.primary;
          const toneBg =
            tip.tone === 'success'
              ? theme.colors.successSoft
              : tip.tone === 'warning'
                ? theme.colors.warningSoft
                : tip.tone === 'danger'
                  ? theme.colors.dangerSoft
                  : theme.colors.primarySoft;

          return (
            <View key={tip.title} style={[styles.tipCard, { borderColor: toneColor + '30' }]}>
              <View style={[styles.tipIconWrap, { backgroundColor: toneBg }]}>
                <Text style={styles.tipIcon}>{tip.icon}</Text>
              </View>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipDetail}>{tip.detail}</Text>
            </View>
          );
        })}
      </View>

      {/* Recent alerts */}
      <SectionHeader
        title="Recent Alerts"
        rightSlot={
          recentAlerts.length > 0 ? (
            <Badge label={`${recentAlerts.length} recent`} tone="warning" />
          ) : undefined
        }
      />
      {latestAlertQuery.isLoading ? (
        <ListSkeleton rows={3} />
      ) : recentAlerts.length > 0 ? (
        <View style={styles.alertsList}>
          {recentAlerts.map((event) => (
            <View key={event.id} style={styles.alertRow}>
              <View style={styles.alertIconWrap}>
                <Text style={styles.alertIcon}>{getEventIcon(event.type)}</Text>
              </View>
              <View style={styles.alertContent}>
                <View style={styles.alertTopRow}>
                  <Text style={styles.alertType}>
                    {event.type.replaceAll('_', ' ')}
                  </Text>
                  <SeverityBadge severity={event.severity} />
                </View>
                <Text style={styles.alertMeta}>
                  Bike {event.bikeId ? event.bikeId.slice(0, 8) : 'unassigned'} · {formatTimeAgo(event.ts)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          title="All clear"
          description="No recent alerts. Clean riding keeps this feed quiet."
        />
      )}

      {latestAlertQuery.isError ? (
        <ErrorState
          title="Alerts unavailable"
          description="Alerts could not be refreshed right now."
          retryLabel="Reload alerts"
          onRetry={() => {
            void latestAlertQuery.refetch();
          }}
        />
      ) : null}

      <View style={styles.logoutWrap}>
        <SecondaryButton label="Sign out" onPress={() => void auth.logout()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greetingSection: {
    gap: theme.spacing.sm,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 2,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  greetingText: {
    flex: 1,
    gap: 2,
  },
  greetingName: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
  },
  greetingSubtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textSecondary,
  },
  scoreCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.hero,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    ...theme.shadow,
  },
  scoreCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  scoreSummary: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  scoreCardTitle: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreHeadline: {
    fontSize: theme.typography.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
  },
  scoreBody: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
  },
  bestWorstRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  miniStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: theme.radius.input,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  miniStatValue: {
    fontSize: theme.typography.emphasis,
    fontWeight: '800',
  },
  miniStatLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  quickStatCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadowLight,
  },
  quickStatIcon: {
    fontSize: 22,
  },
  quickStatValue: {
    fontSize: theme.typography.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
  },
  quickStatLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastTripContent: {
    gap: theme.spacing.md,
  },
  tripMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  tripMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tripMetricValue: {
    fontSize: theme.typography.hero,
    fontWeight: '800',
    color: theme.colors.text,
  },
  tripMetricUnit: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tripMetricDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.border,
  },
  tripTimestamp: {
    fontSize: theme.typography.small,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  tipsGrid: {
    gap: theme.spacing.sm,
  },
  tipCard: {
    borderWidth: 1,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.sm,
    ...theme.shadowLight,
  },
  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipIcon: {
    fontSize: 18,
  },
  tipTitle: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tipDetail: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
  },
  alertsList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadowLight,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.cardPadding,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderFaint,
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIcon: {
    fontSize: 16,
  },
  alertContent: {
    flex: 1,
    gap: 3,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  alertType: {
    flex: 1,
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  alertMeta: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  logoutWrap: {
    paddingBottom: theme.spacing.xl,
  },
  scoreSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  scoreSkeletonText: {
    flex: 1,
    gap: theme.spacing.sm,
  },
});
