import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { PendingSetupGate } from '../components/pending-setup-gate';
import { AppCard } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { Badge, ScoreBadge, SeverityBadge } from '../components/ui/badge';
import { ListItem } from '../components/ui/list-item';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { CardSkeleton, ListSkeleton, SkeletonBlock } from '../components/ui/skeleton';
import { ScoreRing } from '../components/ui/score-ring';
import { ApiError, apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import {
  liveBikeStateSchema,
  paginatedResponseSchema,
  riderEventSchema,
  riderTripSchema,
  riderWeeklyScoreSchema,
} from '../lib/api/schemas';
import { useAuth } from '../lib/auth/auth-context';
import { useLanguage } from '../lib/i18n/language-context';
import { logAppError } from '../lib/monitoring/error-log';
import type {
  LiveBikeState,
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
  t: any,
): CoachingTip[] {
  const tips: CoachingTip[] = [];

  if (recentAlerts.some((event) => event.type === 'OVERSPEED')) {
    tips.push({
      title: t.home.coachingTipSpeedTitle,
      detail: t.home.coachingTipSpeedDetail,
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
      title: t.home.coachingTipBrakeTitle,
      detail: t.home.coachingTipBrakeDetail,
      icon: '🎯',
      tone: 'primary',
    });
  }

  if ((weeklyScore?.avgScore ?? 0) >= 85) {
    tips.push({
      title: t.home.coachingTipMomentumTitle,
      detail: t.home.coachingTipMomentumDetail,
      icon: '🏆',
      tone: 'success',
    });
  }

  if (!latestTrip) {
    tips.push({
      title: t.home.coachingTipFirstRideTitle,
      detail: t.home.coachingTipFirstRideDetail,
      icon: '🚀',
      tone: 'primary',
    });
  } else if (latestTrip.distanceKm < 5) {
    tips.push({
      title: t.home.coachingTipLongerTitle,
      detail: t.home.coachingTipLongerDetail,
      icon: '📏',
      tone: 'primary',
    });
  }

  if (tips.length < 2) {
    tips.push({
      title: t.home.coachingTipCheckTitle,
      detail: t.home.coachingTipCheckDetail,
      icon: '🔧',
      tone: 'primary',
    });
  }

  return tips.slice(0, 3);
}

// Shows rider home insights including weekly score, latest trip, and recent alerts.
export function HomeScreen() {
  const auth = useAuth();
  const { t } = useLanguage();

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

  const activeAssignment = auth.riderMe?.assignments.find((assignment) => assignment.active) ?? null;

  const liveStateQuery = useQuery({
    queryKey: ['rider-bike-state', activeAssignment?.bikeId],
    queryFn: () =>
      apiFetch<LiveBikeState>(
        `/rider/bikes/${activeAssignment!.bikeId}/state`,
        undefined,
        { schema: liveBikeStateSchema },
      ),
    enabled: !!activeAssignment?.bikeId && auth.riderMe?.isPersonalOwner === true,
    refetchInterval: 10000,
  });

  const lockMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/rider/bikes/${activeAssignment!.bikeId}/lock`, { method: 'POST' }),
    onSuccess: () => Alert.alert('Command Sent', 'Locking your bike...'),
    onError: (err: any) => Alert.alert('Command Failed', err.message),
  });

  const unlockMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/rider/bikes/${activeAssignment!.bikeId}/unlock`, { method: 'POST' }),
    onSuccess: () => Alert.alert('Command Sent', 'Unlocking your bike...'),
    onError: (err: any) => Alert.alert('Command Failed', err.message),
  });

  const refreshAll = async (): Promise<void> => {
    await Promise.all([
      auth.refreshRiderMe(),
      weeklyScoreQuery.refetch(),
      latestTripQuery.refetch(),
      latestAlertQuery.refetch(),
      liveStateQuery.refetch(),
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
  const scoreTone = getScoreTone(weeklyScore?.avgScore);
  const coachingTips = buildCoachingTips(weeklyScore, latestTrip, recentAlerts, t);
  const firstName = (auth.riderMe?.fullName ?? 'Rider').split(' ')[0];

  const localizedScoreHeadline =
    weeklyScore?.avgScore === undefined || weeklyScore?.avgScore === null
      ? t.home.noScoreYet
      : weeklyScore.avgScore >= 85
      ? t.home.scoreStrong
      : weeklyScore.avgScore >= 70
      ? t.home.scoreNeedsAttention
      : t.home.scoreHighRisk;

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

  if (auth.riderMe?.status === 'PENDING_SETUP') {
    return (
      <ScreenContainer
        refreshing={weeklyScoreQuery.isRefetching}
        onRefresh={() => void refreshAll()}
      >
        <PendingSetupGate
          isRefetching={weeklyScoreQuery.isRefetching}
          onRefresh={() => void refreshAll()}
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
            <Text style={styles.greetingName}>{t.home.greeting}, {firstName}</Text>
            <Text style={styles.greetingSubtitle}>
              {weeklyScore?.tripCount
                ? t.home.ridesCountThisWeek.replace('{count}', String(weeklyScore.tripCount))
                : t.home.staySmoothRideSafe}
            </Text>
          </View>
          <Badge label={localizedScoreHeadline} tone={scoreTone.badgeTone} />
        </View>
      </View>

      {/* Score hero card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreCardInner}>
          <ScoreRing score={weeklyScore?.avgScore ?? null} size={130} />
          <View style={styles.scoreSummary}>
            <Text style={styles.scoreCardTitle}>{t.home.safetyScore}</Text>
            <Text style={styles.scoreHeadline}>{localizedScoreHeadline}</Text>
            <Text style={styles.scoreBody}>
              {t.home.tripsScoredThisWeek.replace('{count}', String(weeklyScore?.tripCount ?? 0))}
            </Text>
            <View style={styles.bestWorstRow}>
              <View style={[styles.miniStat, { borderColor: theme.colors.successBorder, backgroundColor: theme.colors.successSoft }]}>
                <Text style={[styles.miniStatValue, { color: theme.colors.success }]}>
                  {weeklyScore?.bestScore?.toFixed(0) ?? '--'}
                </Text>
                <Text style={styles.miniStatLabel}>{t.profile.bestScore}</Text>
              </View>
              <View style={[styles.miniStat, { borderColor: theme.colors.warningBorder, backgroundColor: theme.colors.warningSoft }]}>
                <Text style={[styles.miniStatValue, { color: theme.colors.warning }]}>
                  {weeklyScore?.worstScore?.toFixed(0) ?? '--'}
                </Text>
                <Text style={styles.miniStatLabel}>{t.profile.worstScore}</Text>
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
          <Text style={styles.quickStatLabel}>{t.home.bikesCount}</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>📍</Text>
          <Text style={styles.quickStatValue} numberOfLines={1}>
            {activeAssignment?.bikeLabel ?? '—'}
          </Text>
          <Text style={styles.quickStatLabel}>{t.home.primaryBike}</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>⚠️</Text>
          <Text style={styles.quickStatValue}>{recentAlerts.length}</Text>
          <Text style={styles.quickStatLabel}>{t.home.alertsCount}</Text>
        </View>
      </View>

      {/* Personal Owner Controls */}
      {auth.riderMe?.isPersonalOwner && activeAssignment && (
        <AppCard title={t.home.myBikeControls}>
          <View style={styles.ownerControls}>
            <View style={styles.batteryRow}>
              <View style={styles.batteryIconWrap}>
                <Text style={styles.batteryIcon}>🔋</Text>
              </View>
              <View style={styles.batteryTextWrap}>
                <Text style={styles.batteryTitle}>{t.home.batteryStatus}</Text>
                <Text style={styles.batteryDetail}>
                  {liveStateQuery.data
                    ? `${liveStateQuery.data.batteryPct.toFixed(0)}% • ${liveStateQuery.data.batteryV.toFixed(1)}V`
                    : liveStateQuery.isLoading
                    ? t.common.loading
                    : 'Unknown'}
                </Text>
              </View>
            </View>
            <View style={styles.lockButtons}>
              <View style={styles.lockBtnWrap}>
                <PrimaryButton
                  label={t.home.unlock}
                  onPress={() => unlockMutation.mutate()}
                  loading={unlockMutation.isPending}
                />
              </View>
              <View style={styles.lockBtnWrap}>
                <PrimaryButton
                  label={t.home.lock}
                  tone="danger"
                  disabled={true}
                  onPress={() => {}}
                  loading={false}
                />
              </View>
            </View>
          </View>
        </AppCard>
      )}

      {/* Personal Owner Bike Location */}
      {auth.riderMe?.isPersonalOwner && activeAssignment && (
        <AppCard title={t.home.myBikeLocation}>
          <View style={styles.ownerLocation}>
            <View style={styles.locationMetaRow}>
              <View style={styles.gpsIconWrap}>
                <Text style={styles.gpsIcon}>📍</Text>
              </View>
              <View style={styles.gpsTextWrap}>
                <View style={styles.gpsStatusRow}>
                  <Text style={styles.gpsTitle}>{t.home.gpsTracking}</Text>
                  {liveStateQuery.data ? (
                    <View style={styles.activeGlowContainer}>
                      <View style={styles.activeGlowPulse} />
                      <Text style={styles.activeGlowText}>{t.common.online}</Text>
                    </View>
                  ) : (
                    <Badge label={t.common.offline} tone="warning" />
                  )}
                </View>
                <Text style={styles.gpsDetail}>
                  {liveStateQuery.data
                    ? `${liveStateQuery.data.lat.toFixed(6)}, ${liveStateQuery.data.lng.toFixed(6)}`
                    : liveStateQuery.isLoading
                    ? t.common.loading
                    : 'Coordinates unavailable'}
                </Text>
              </View>
            </View>

            {liveStateQuery.data && (
              <View style={styles.gpsStatsRow}>
                <View style={styles.gpsStat}>
                  <Text style={styles.gpsStatLabel}>Satellites</Text>
                  <Text style={styles.gpsStatVal}>🛰️ {liveStateQuery.data.gnssSats}</Text>
                </View>
                <View style={styles.gpsStat}>
                  <Text style={styles.gpsStatLabel}>Signal</Text>
                  <Text style={styles.gpsStatVal}>📶 {liveStateQuery.data.signalDbm}dBm</Text>
                </View>
                <View style={styles.gpsStat}>
                  <Text style={styles.gpsStatLabel}>Status</Text>
                  <Text style={styles.gpsStatVal}>
                    {liveStateQuery.data.motion ? 'Moving 🏍️' : 'Parked 🔒'}
                  </Text>
                </View>
              </View>
            )}

            <PrimaryButton
              label={t.home.trackOnLiveMap}
              disabled={!liveStateQuery.data}
              onPress={async () => {
                if (liveStateQuery.data) {
                  const directionsLink = `https://www.google.com/maps/search/?api=1&query=${liveStateQuery.data.lat},${liveStateQuery.data.lng}`;
                  const canOpen = await Linking.canOpenURL(directionsLink);
                  if (canOpen) {
                    await Linking.openURL(directionsLink);
                  }
                }
              }}
            />
          </View>
        </AppCard>
      )}

      {/* Last trip card */}
      <AppCard
        title={t.home.lastTrip}
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
                <Text style={styles.tripMetricUnit}>{t.common.duration}</Text>
              </View>
              {latestTrip.consumptionPct !== null && (
                <>
                  <View style={styles.tripMetricDivider} />
                  <View style={styles.tripMetric}>
                    <Text style={[styles.tripMetricValue, { color: theme.colors.success }]}>
                      {latestTrip.consumptionPct.toFixed(0)}%
                    </Text>
                    <Text style={styles.tripMetricUnit}>{t.common.used}</Text>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.tripTimestamp}>
              Started {formatTimestamp(latestTrip.startTs)}
            </Text>
          </View>
        ) : (
          <EmptyState
            title={t.home.noRecentTrips}
            description={t.home.scoreSubtitle}
          />
        )}
      </AppCard>

      {/* Coaching tips */}
      <SectionHeader title={t.home.coaching} subtitle={t.home.coachingSubtitle} />
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
        title={t.home.recentAlerts}
        rightSlot={
          recentAlerts.length > 0 ? (
            <Badge label={`${recentAlerts.length}`} tone="warning" />
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
          title={t.home.allClear}
          description={t.home.allClearDesc}
        />
      )}

      {latestAlertQuery.isError ? (
        <ErrorState
          title={t.common.error}
          description={t.common.error}
          retryLabel={t.common.retry}
          onRetry={() => {
            void latestAlertQuery.refetch();
          }}
        />
      ) : null}

      <View style={styles.logoutWrap}>
        <SecondaryButton label={t.common.signOut} onPress={() => void auth.logout()} />
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
  ownerControls: {
    gap: theme.spacing.lg,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  batteryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryIcon: {
    fontSize: 22,
  },
  batteryTextWrap: {
    flex: 1,
  },
  batteryTitle: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  batteryDetail: {
    fontSize: theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  lockButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  lockBtnWrap: {
    flex: 1,
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
  pendingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  pendingIcon: {
    fontSize: 64,
    textAlign: 'center',
  },
  pendingTitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  pendingText: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  pendingButtons: {
    width: '100%',
    marginTop: theme.spacing.md,
  },
  stepList: {
    gap: theme.spacing.sm,
  },
  stepText: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  ownerLocation: {
    gap: theme.spacing.md,
  },
  locationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  gpsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsIcon: {
    fontSize: 22,
  },
  gpsTextWrap: {
    flex: 1,
  },
  gpsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  gpsTitle: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  gpsDetail: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  activeGlowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeGlowPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  activeGlowText: {
    fontSize: theme.typography.caption,
    fontWeight: '800',
    color: theme.colors.success,
  },
  gpsStatsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  gpsStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    gap: 2,
  },
  gpsStatLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  gpsStatVal: {
    fontSize: theme.typography.caption,
    fontWeight: '800',
    color: theme.colors.text,
  },
});
