import { useQuery, useMutation } from '@tanstack/react-query';
import { Clipboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState, useEffect } from 'react';
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
import { useLanguage } from '../lib/i18n/language-context';
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
  const { t, locale, setLocale } = useLanguage();
  const me = auth.riderMe;
  const user = auth.user;
  const [copiedId, setCopiedId] = useState<'rider' | 'fleet' | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const onlineQuery = useQuery({
    queryKey: ['rider-online-status'],
    queryFn: () => apiFetch<{ online: boolean }>('/rider/online'),
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: (online: boolean) =>
      apiFetch<{ online: boolean }>('/rider/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online }),
      }),
    onSuccess: (data) => {
      setIsOnline(data.online);
    },
  });

  useEffect(() => {
    if (onlineQuery.data) {
      setIsOnline(onlineQuery.data.online);
    }
  }, [onlineQuery.data]);

  const copyToClipboard = (text: string) => {
    if (Clipboard && typeof Clipboard.setString === 'function') {
      Clipboard.setString(text);
    } else if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
    }
  };

  const handleCopy = (idType: 'rider' | 'fleet', text: string) => {
    copyToClipboard(text);
    setCopiedId(idType);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

      {/* Online/Offline Toggle */}
      <View style={styles.onlineToggleSection}>
        <Pressable
          onPress={() => toggleOnlineMutation.mutate(!isOnline)}
          disabled={toggleOnlineMutation.isPending}
          style={[
            styles.onlineToggleButton,
            isOnline ? styles.onlineButtonActive : styles.onlineButtonInactive,
          ]}
        >
          <Text style={styles.onlineButtonText}>
            {toggleOnlineMutation.isPending
              ? t.common.updating
              : isOnline
              ? t.profile.toggleActiveOnline
              : t.profile.toggleOffline}
          </Text>
        </Pressable>
      </View>

      {/* Language Selection Card */}
      <AppCard title={t.profile.languageSection}>
        <View style={styles.languageContainer}>
          <Pressable
            onPress={() => void setLocale('en')}
            style={[
              styles.languageButton,
              locale === 'en' ? styles.languageButtonActive : styles.languageButtonInactive,
            ]}
          >
            <Text
              style={[
                styles.languageButtonText,
                locale === 'en' ? styles.languageTextActive : styles.languageTextInactive,
              ]}
            >
              {t.profile.languageEnglish}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void setLocale('rw')}
            style={[
              styles.languageButton,
              locale === 'rw' ? styles.languageButtonActive : styles.languageButtonInactive,
            ]}
          >
            <Text
              style={[
                styles.languageButtonText,
                locale === 'rw' ? styles.languageTextActive : styles.languageTextInactive,
              ]}
            >
              {t.profile.languageKinyarwanda}
            </Text>
          </Pressable>
        </View>
      </AppCard>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBox
          icon="🏆"
          value={weeklyScore?.avgScore?.toFixed(0) ?? '--'}
          label={t.home.avgWeeklyScore}
        />
        <StatBox
          icon="🛣️"
          value={String(weeklyScore?.tripCount ?? 0)}
          label={t.common.thisWeek}
        />
        <StatBox
          icon="📊"
          value={String(totalTrips)}
          label={t.common.total}
        />
        <StatBox
          icon="🏍️"
          value={String(activeAssignments.length)}
          label={t.profile.assignedBikes}
        />
      </View>

      {/* Account info */}
      <AppCard title={t.profile.accountSection}>
        <View style={styles.infoStack}>
          <InfoRow label={t.profile.fullName} value={me?.fullName} />
          <InfoRow label={t.profile.phone} value={me?.phone} />
          <InfoRow label={t.profile.email} value={me?.email} fallback={t.profile.notSet} />
        </View>
      </AppCard>

      {/* Assigned bikes */}
      <SectionHeader
        title={t.profile.assignedBikes}
        rightSlot={
          <Badge label={`${assignments.length} ${t.common.total}`} tone="primary" />
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
                    <Badge label={t.profile.activeStatus} tone="success" />
                  ) : (
                    <Badge label={t.profile.inactiveStatus} tone="neutral" />
                  )}
                </View>
                <Text style={styles.bikeMeta}>
                  {assignment.bikeStatus} · {t.profile.since}{' '}
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
          <Text style={styles.emptyText}>{t.profile.noBikesAssigned}</Text>
        </View>
      )}

      {/* Score trend */}
      {weeklyScoreQuery.isLoading ? (
        <ListSkeleton rows={2} />
      ) : weeklyScore ? (
        <AppCard title={t.profile.scoreBreakdown}>
          <View style={styles.scoreTrendRow}>
            <View style={[styles.trendCard, { borderColor: theme.colors.successBorder }]}>
              <Text style={[styles.trendValue, { color: theme.colors.success }]}>
                {weeklyScore.bestScore?.toFixed(0) ?? '--'}
              </Text>
              <Text style={styles.trendLabel}>{t.profile.bestScore}</Text>
            </View>
            <View style={[styles.trendCard, { borderColor: theme.colors.primaryBorder }]}>
              <Text style={[styles.trendValue, { color: theme.colors.primary }]}>
                {weeklyScore.avgScore?.toFixed(0) ?? '--'}
              </Text>
              <Text style={styles.trendLabel}>{t.profile.averageScore}</Text>
            </View>
            <View style={[styles.trendCard, { borderColor: theme.colors.warningBorder }]}>
              <Text style={[styles.trendValue, { color: theme.colors.warning }]}>
                {weeklyScore.worstScore?.toFixed(0) ?? '--'}
              </Text>
              <Text style={styles.trendLabel}>{t.profile.worstScore}</Text>
            </View>
          </View>
        </AppCard>
      ) : null}

      {/* Support & Diagnostics */}
      <AppCard title={t.profile.supportDiagnostics}>
        <Pressable
          onPress={() => setShowDiagnostics(!showDiagnostics)}
          style={({ pressed }) => [
            styles.diagnosticsTrigger,
            pressed && { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <View style={styles.diagnosticsHeader}>
            <Text style={styles.diagnosticsTitle}>🔧 {t.profile.systemDiagnostics}</Text>
            <Text style={styles.diagnosticsToggle}>
              {showDiagnostics ? t.profile.hideDetails : t.profile.showDetails}
            </Text>
          </View>
        </Pressable>

        {showDiagnostics && (
          <View style={styles.diagnosticsContent}>
            <Text style={styles.diagnosticsDescription}>
              {t.profile.diagnosticsDesc}
            </Text>

            <View style={styles.diagnosticsStack}>
              <Pressable
                onPress={() => handleCopy('rider', me?.userId ?? '')}
                style={({ pressed }) => [
                  styles.copyableRow,
                  pressed && { backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <View>
                  <Text style={styles.copyableLabel}>{t.profile.riderUserId}</Text>
                  <Text style={styles.copyableValue}>{me?.userId ?? '—'}</Text>
                </View>
                <View style={styles.copyBadge}>
                  <Text style={styles.copyBadgeText}>
                    {copiedId === 'rider' ? t.common.copied : t.common.copy}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleCopy('fleet', me?.fleetId ?? '')}
                style={({ pressed }) => [
                  styles.copyableRow,
                  pressed && { backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <View>
                  <Text style={styles.copyableLabel}>{t.profile.operatingFleetId}</Text>
                  <Text style={styles.copyableValue}>{me?.fleetId ?? '—'}</Text>
                </View>
                <View style={styles.copyBadge}>
                  <Text style={styles.copyBadgeText}>
                    {copiedId === 'fleet' ? t.common.copied : t.common.copy}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </AppCard>

      {/* Sign out */}
      <View style={styles.signOutWrap}>
        <SecondaryButton label={t.profile.signOut} onPress={() => void auth.logout()} />
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
  diagnosticsTrigger: {
    paddingVertical: theme.spacing.xs,
  },
  diagnosticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagnosticsTitle: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  diagnosticsToggle: {
    fontSize: theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  diagnosticsContent: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  diagnosticsDescription: {
    fontSize: theme.typography.caption - 1,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  diagnosticsStack: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  copyableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
  },
  copyableLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  copyableValue: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '600',
  },
  copyBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  copyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  onlineToggleSection: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  onlineToggleButton: {
    borderRadius: theme.radius.card,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  onlineButtonActive: {
    backgroundColor: theme.colors.success + '10',
    borderColor: theme.colors.success,
  },
  onlineButtonInactive: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  onlineButtonText: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  languageContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  languageButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  languageButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  languageButtonInactive: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
  },
  languageButtonText: {
    fontSize: theme.typography.body,
    fontWeight: '700',
  },
  languageTextActive: {
    color: '#ffffff',
  },
  languageTextInactive: {
    color: theme.colors.text,
  },
});
