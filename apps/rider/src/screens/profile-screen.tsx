import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ListSkeleton } from '../components/ui/skeleton';
import { ApiError, apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import { paginatedResponseSchema, riderTripSchema, riderWeeklyScoreSchema } from '../lib/api/schemas';
import { useAuth } from '../lib/auth/auth-context';
import { logAppError } from '../lib/monitoring/error-log';
import type { PaginatedResponse, RiderTripSummary, RiderWeeklyScoreResponse } from '../lib/types/api';
import { getScoreTone, theme } from '../theme/tokens';

interface StatBoxProps {
  icon: string;
  value: string;
  label: string;
}

function StatBox({ icon, value, label }: StatBoxProps) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
  fallback?: string;
}

function InfoRow({ label, value, fallback = '—' }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || fallback}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const auth = useAuth();
  const me = auth.riderMe;
  const user = auth.user;
  const firstName = (me?.fullName ?? 'Rider').split(' ')[0];
  const initials = (me?.fullName ?? 'R')
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const assignments = me?.assignments ?? [];
  const activeAssignments = assignments.filter((a) => a.active);

  const weeklyScoreQuery = useQuery({
    queryKey: ['rider-score', 'weekly'],
    queryFn: () =>
      apiFetch<RiderWeeklyScoreResponse>('/rider/score/weekly', undefined, {
        schema: riderWeeklyScoreSchema,
      }),
  });

  const tripsQuery = useQuery({
    queryKey: ['rider-trips-stats'],
    queryFn: () =>
      apiFetch<PaginatedResponse<RiderTripSummary>>(
        `/rider/trips${buildQueryString({ page: 1, pageSize: 1 })}`,
        undefined,
        { schema: paginatedResponseSchema(riderTripSchema) },
      ),
  });

  if (weeklyScoreQuery.isError) {
    logAppError('rider.profile_score_failed', weeklyScoreQuery.error, {
      feature: 'profile',
      operation: 'weeklyScore',
      status: weeklyScoreQuery.error instanceof ApiError ? weeklyScoreQuery.error.status : undefined,
    });
  }

  const weeklyScore = weeklyScoreQuery.data;
  const scoreTone = getScoreTone(weeklyScore?.avgScore);
  const totalTrips = tripsQuery.data?.total ?? 0;

  const refreshAll = async (): Promise<void> => {
    await Promise.all([
      auth.refreshRiderMe(),
      weeklyScoreQuery.refetch(),
      tripsQuery.refetch(),
    ]);
  };

  const statusTone =
    user?.status === 'ACTIVE'
      ? 'success'
      : user?.status === 'SUSPENDED'
        ? 'danger'
        : ('warning' as const);

  return (
    <ScreenContainer
      refreshing={weeklyScoreQuery.isRefetching || tripsQuery.isRefetching}
      onRefresh={() => void refreshAll()}
    >
      {/* Profile hero */}
      <View style={styles.profileHero}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{me?.fullName ?? 'Rider'}</Text>
        <View style={styles.profileBadges}>
          <Badge label={user?.status ?? 'ACTIVE'} tone={statusTone} />
          <Badge label={scoreTone.label} tone={scoreTone.badgeTone} />
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBox
          icon="🏆"
          value={weeklyScore?.avgScore?.toFixed(0) ?? '--'}
          label="Avg Score"
        />
        <StatBox
          icon="🛣️"
          value={String(weeklyScore?.tripCount ?? 0)}
          label="This Week"
        />
        <StatBox
          icon="📊"
          value={String(totalTrips)}
          label="Total Trips"
        />
        <StatBox
          icon="🏍️"
          value={String(activeAssignments.length)}
          label="Bikes"
        />
      </View>

      {/* Account info */}
      <AppCard title="Account">
        <View style={styles.infoStack}>
          <InfoRow label="Full Name" value={me?.fullName} />
          <InfoRow label="Phone" value={me?.phone} />
          <InfoRow label="Email" value={me?.email} fallback="Not set" />
          <InfoRow label="Rider ID" value={me?.userId?.slice(0, 12)} />
          <InfoRow label="Fleet ID" value={me?.fleetId?.slice(0, 12)} />
        </View>
      </AppCard>

      {/* Assigned bikes */}
      <SectionHeader
        title="Assigned Bikes"
        rightSlot={
          <Badge label={`${assignments.length} total`} tone="primary" />
        }
      />
      {assignments.length > 0 ? (
        <View style={styles.bikesList}>
          {assignments.map((assignment) => (
            <View key={assignment.id} style={styles.bikeCard}>
              <View style={styles.bikeIconWrap}>
                <Text style={styles.bikeIcon}>🏍️</Text>
              </View>
              <View style={styles.bikeInfo}>
                <View style={styles.bikeNameRow}>
                  <Text style={styles.bikeName} numberOfLines={1}>
                    {assignment.bikeLabel}
                  </Text>
                  {assignment.active ? (
                    <Badge label="Active" tone="success" />
                  ) : (
                    <Badge label="Inactive" tone="neutral" />
                  )}
                </View>
                <Text style={styles.bikeMeta}>
                  {assignment.bikeStatus} · Since{' '}
                  {new Date(assignment.assignedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyBikes}>
          <Text style={styles.emptyText}>No bikes assigned yet</Text>
        </View>
      )}

      {/* Score trend */}
      {weeklyScoreQuery.isLoading ? (
        <ListSkeleton rows={2} />
      ) : weeklyScore ? (
        <AppCard title="Score Breakdown">
          <View style={styles.scoreTrendRow}>
            <View style={[styles.trendCard, { borderColor: theme.colors.successBorder }]}>
              <Text style={[styles.trendValue, { color: theme.colors.success }]}>
                {weeklyScore.bestScore?.toFixed(0) ?? '--'}
              </Text>
              <Text style={styles.trendLabel}>Best</Text>
            </View>
            <View style={[styles.trendCard, { borderColor: theme.colors.primaryBorder }]}>
              <Text style={[styles.trendValue, { color: theme.colors.primary }]}>
                {weeklyScore.avgScore?.toFixed(0) ?? '--'}
              </Text>
              <Text style={styles.trendLabel}>Average</Text>
            </View>
            <View style={[styles.trendCard, { borderColor: theme.colors.warningBorder }]}>
              <Text style={[styles.trendValue, { color: theme.colors.warning }]}>
                {weeklyScore.worstScore?.toFixed(0) ?? '--'}
              </Text>
              <Text style={styles.trendLabel}>Worst</Text>
            </View>
          </View>
        </AppCard>
      ) : null}

      {/* Sign out */}
      <View style={styles.signOutWrap}>
        <SecondaryButton label="Sign out" onPress={() => void auth.logout()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileHero: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 3,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: theme.typography.hero,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  profileName: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadowLight,
  },
  statIcon: {
    fontSize: 20,
  },
  statValue: {
    fontSize: theme.typography.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoStack: {
    gap: 0,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderFaint,
  },
  infoLabel: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  bikesList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadowLight,
  },
  bikeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.cardPadding,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderFaint,
  },
  bikeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeIcon: {
    fontSize: 20,
  },
  bikeInfo: {
    flex: 1,
    gap: 3,
  },
  bikeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  bikeName: {
    flex: 1,
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  bikeMeta: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  emptyBikes: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
  },
  scoreTrendRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  trendCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  trendValue: {
    fontSize: theme.typography.section,
    fontWeight: '800',
  },
  trendLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  signOutWrap: {
    paddingBottom: theme.spacing.xl,
  },
});
