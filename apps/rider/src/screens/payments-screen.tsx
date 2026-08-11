import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ListSkeleton } from '../components/ui/skeleton';
import { apiFetch } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { useLanguage } from '../lib/i18n/language-context';
import type { RiderPaymentSummary, MomoPaymentResponse } from '../lib/types/api';
import { theme } from '../theme/tokens';

function formatRwf(amount: number): string {
  return amount.toLocaleString() + ' RWF';
}

export function PaymentsScreen() {
  const auth = useAuth();
  const { t } = useLanguage();
  const riderPhone = auth.riderMe?.phone || auth.user?.phone || '0780000100';

  const [modalVisible, setModalVisible] = useState(false);
  const [amountInput, setAmountInput] = useState('15000');
  const [phoneInput, setPhoneInput] = useState(riderPhone);
  const [isPartial, setIsPartial] = useState(false);
  const [partialReason, setPartialReason] = useState('');
  const [activeRefId, setActiveRefId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['rider-payment-summary'],
    queryFn: () => apiFetch<RiderPaymentSummary>('/rider/payments/summary'),
    enabled: auth.status === 'authenticated' && !!auth.token,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        return false;
      }
      return failureCount < 2;
    },
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        return false;
      }
      return 5000;
    },
  });

  const payMutation = useMutation({
    mutationFn: (body: {
      amount?: number;
      momoPhoneNumber?: string;
      isPartial?: boolean;
      partialReason?: string;
    }) =>
      apiFetch<MomoPaymentResponse>('/rider/payments/pay-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      setActiveRefId(data.referenceId);
      setPayError(null);
    },
    onError: (err: any) => {
      setPayError(err.message || 'Failed to initiate payment');
    },
  });

  const statusQuery = useQuery({
    queryKey: ['rider-payment-status', activeRefId],
    queryFn: () =>
      apiFetch<MomoPaymentResponse>(`/rider/payments/status/${activeRefId}`),
    enabled: !!activeRefId && auth.status === 'authenticated' && !!auth.token,
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        return false;
      }
      const data = query.state.data;
      if (data && (data.status === 'SUCCESSFUL' || data.status === 'FAILED')) {
        return false;
      }
      return 3000;
    },
  });

  useEffect(() => {
    if (statusQuery.data?.status === 'SUCCESSFUL') {
      summaryQuery.refetch();
    }
  }, [statusQuery.data?.status]);

  const defaultDailyRate = summaryQuery.data?.assignedRate || summaryQuery.data?.leaseDailyRate || 15000;
  const schedulePeriodDays = summaryQuery.data?.schedulePeriodDays || (summaryQuery.data?.paymentSchedule === 'WEEKLY' ? 7 : summaryQuery.data?.paymentSchedule === 'CUSTOM' ? (summaryQuery.data?.customScheduleDays || 1) : 1);
  const requiredPeriodAmount = summaryQuery.data?.requiredPeriodAmount || (defaultDailyRate * schedulePeriodDays);
  const requiredTotalAmount = summaryQuery.data?.requiredTotalAmount || (requiredPeriodAmount + (summaryQuery.data?.arrears || 0));

  const handlePayPress = () => {
    setPayError(null);
    const amountNum = parseInt(amountInput, 10);
    if (isNaN(amountNum) || amountNum < 100) {
      setPayError('Please enter a valid amount (minimum 100 RWF)');
      return;
    }

    const checkPartial = isPartial || amountNum < requiredPeriodAmount;
    if (checkPartial && !partialReason.trim()) {
      setPayError(t.payments.partialReasonError);
      return;
    }

    payMutation.mutate({
      amount: amountNum,
      momoPhoneNumber: phoneInput,
      isPartial: checkPartial,
      partialReason: checkPartial ? partialReason.trim() : undefined,
    });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setActiveRefId(null);
    setPayError(null);
    setIsPartial(false);
    setPartialReason('');
  };

  const summary = summaryQuery.data;
  const statusData = statusQuery.data;

  const statusTone: 'success' | 'danger' | 'primary' =
    summary?.status === 'UP_TO_DATE'
      ? 'success'
      : summary?.status === 'PAID_OFF'
      ? 'primary'
      : 'danger';

  const scheduleBadgeLabel =
    summary?.paymentSchedule === 'WEEKLY'
      ? t.payments.scheduleWeekly
      : summary?.paymentSchedule === 'CUSTOM'
      ? t.payments.scheduleCustom.replace('{days}', String(summary?.customScheduleDays || 1))
      : t.payments.scheduleDaily;

  return (
    <ScreenContainer
      refreshing={summaryQuery.isRefetching}
      onRefresh={() => void summaryQuery.refetch()}
    >
      <SectionHeader
        title={t.payments.title}
        subtitle={t.payments.weeklyGrid}
      />

      {summaryQuery.isLoading ? (
        <ListSkeleton rows={2} />
      ) : (
        <>
          {/* Overdue Warning & Remote Lock Risk Banner */}
          {(summary?.arrears || 0) > 0 && (
            <View style={{ marginBottom: theme.spacing.sm }}>
              <AppCard>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.danger, fontWeight: '700' }]}>
                    ⚠️ {t.payments.lockWarningTitle}
                  </Text>
                  <Badge label="LOCK RISK" tone="danger" />
                </View>
                <Text style={{ fontSize: 13, color: theme.colors.text, marginTop: 4, lineHeight: 18 }}>
                  {summary?.overdueWarning?.warningMessageRw ||
                    `Uri mu kirarane cy'iminsi ${summary?.daysInArrears || 1} (${formatRwf(summary?.arrears || 0)}). Wishyure ubu kugira ngo velo yawe itazafungwa kure.`}
                </Text>
                <View style={styles.statsGrid}>
                  <View style={[styles.statBox, styles.statBoxDanger]}>
                    <Text style={styles.statBoxLabel}>{t.payments.timePassedArrears}</Text>
                    <Text style={[styles.statBoxValue, styles.textDanger]}>
                      {formatRwf(summary?.timeArrears || summary?.arrears || 0)}
                    </Text>
                  </View>
                  <View style={[styles.statBox, styles.statBoxDanger]}>
                    <Text style={styles.statBoxLabel}>{t.payments.overdueDays}</Text>
                    <Text style={[styles.statBoxValue, styles.textDanger]}>
                      {summary?.daysInArrears || 0} days
                    </Text>
                  </View>
                </View>
              </AppCard>
            </View>
          )}

          {/* Main Financial Overview Card */}
          <AppCard>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.cardSubtitle}>
                  {summary?.isLeaseToOwn ? t.payments.leaseToOwnPlan : t.payments.dailyRental}
                </Text>
                <Text style={styles.cardTitle}>
                  {formatRwf(requiredPeriodAmount)}{' '}
                  <Text style={styles.perDay}>({scheduleBadgeLabel})</Text>
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 2 }}>
                  {formatRwf(defaultDailyRate)} {t.payments.perDay}
                </Text>
              </View>
              <Badge
                label={summary?.status?.replace('_', ' ') || 'UP TO DATE'}
                tone={statusTone}
              />
            </View>

            {/* Admin Schedule & Due Date Row */}
            <View
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                borderRadius: theme.radius.card,
                padding: theme.spacing.sm,
                marginVertical: theme.spacing.xs,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>
                🗓️ {scheduleBadgeLabel} &middot;{' '}
                {summary?.paymentSchedule === 'WEEKLY'
                  ? t.payments.weekOver.replace('{days}', String(Math.max(0, summary?.daysUntilDue ?? 0)))
                  : summary?.isPeriodOver
                  ? t.payments.periodExpired
                  : t.payments.daysRemaining.replace('{days}', String(Math.max(0, summary?.daysUntilDue ?? 0)))}
              </Text>
              {summary?.nextDueAt && (
                <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 2 }}>
                  {t.payments.nextDueDate}:{' '}
                  {new Date(summary.nextDueAt).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              )}
            </View>

            {summary?.isLeaseToOwn && (
              <View style={styles.progressContainer}>
                <View style={styles.progressTextRow}>
                  <Text style={styles.progressLabel}>{t.payments.leasePrincipalPaid}</Text>
                  <Text style={styles.progressValue}>
                    {Math.round(
                      ((summary?.totalPaid || 0) /
                        (summary?.leasePrincipal || 2500000)) *
                        100,
                    )}
                    %
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((summary?.totalPaid || 0) /
                              (summary?.leasePrincipal || 2500000)) *
                              100,
                          ),
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressSubRow}>
                  <Text style={styles.subText}>
                    {t.payments.paid}: {formatRwf(summary?.totalPaid || 0)}
                  </Text>
                  <Text style={styles.subText}>
                    {t.payments.remainingOwnership}: {formatRwf(summary?.remainingLeaseBalance || Math.max(0, (summary?.leasePrincipal || 2500000) - (summary?.totalPaid || 0)))}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>{t.payments.paid}</Text>
                <Text style={styles.statBoxValue}>
                  {formatRwf(summary?.totalPaid || 0)}
                </Text>
              </View>
              <View
                style={[
                  styles.statBox,
                  (summary?.arrears || 0) > 0 && styles.statBoxDanger,
                ]}
              >
                <Text style={styles.statBoxLabel}>{t.payments.unpaidDebts}</Text>
                <Text
                  style={[
                    styles.statBoxValue,
                    (summary?.arrears || 0) > 0 && styles.textDanger,
                  ]}
                >
                  {formatRwf(summary?.arrears || 0)}
                </Text>
              </View>
            </View>

            <View style={styles.payButtonWrapper}>
              <PrimaryButton
                label={`💳 ${t.payments.payNow}`}
                onPress={() => {
                  setAmountInput(String(requiredPeriodAmount));
                  setPhoneInput(riderPhone);
                  setModalVisible(true);
                }}
              />
            </View>
          </AppCard>

          {/* Payment History Section */}
          <SectionHeader
            title={t.payments.paymentHistory}
            subtitle={t.payments.weeklyGrid}
          />

          {summary?.recentPayments && summary.recentPayments.length > 0 ? (
            summary.recentPayments.map((p) => (
              <View key={p.id} style={styles.historyCardWrapper}>
                <AppCard>
                  <View style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyAmount}>
                        {formatRwf(p.amount)}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(p.paidAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      {p.isPartial || p.status === 'PARTIAL' ? (
                        <Badge label={t.payments.statusPartial} tone="warning" />
                      ) : (
                        <Badge
                          label={p.method}
                          tone={p.method === 'MOBILE_MONEY' ? 'primary' : 'neutral'}
                        />
                      )}
                      {p.reference && (
                        <Text style={styles.historyRef}>Ref: {p.reference}</Text>
                      )}
                    </View>
                  </View>
                  {p.partialReason && (
                    <Text style={styles.partialReasonText}>
                      Reason: {p.partialReason}
                    </Text>
                  )}
                </AppCard>
              </View>
            ))
          ) : (
            <AppCard>
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyText}>{t.payments.noPaymentsYet}</Text>
              </View>
            </AppCard>
          )}
        </>
      )}

      {/* Pay Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.payments.momoTitle}</Text>
            <Text style={styles.modalSubtitle}>
              {t.payments.momoSubtitle
                .replace('{schedule}', scheduleBadgeLabel)
                .replace('{amount}', formatRwf(requiredPeriodAmount))}
            </Text>

            {!activeRefId ? (
              <>
                {/* Preset amount selector */}
                <Text style={styles.inputLabel}>{t.payments.selectAmount}</Text>
                <View style={styles.presetsRow}>
                  {Array.from(new Set([
                    requiredPeriodAmount,
                    Math.round(requiredPeriodAmount / 2),
                    ...(requiredTotalAmount > requiredPeriodAmount ? [requiredTotalAmount] : []),
                  ])).map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => {
                        setAmountInput(String(amt));
                        if (amt < requiredPeriodAmount) {
                          setIsPartial(true);
                        } else {
                          setIsPartial(false);
                        }
                      }}
                      style={[
                        styles.presetChip,
                        amountInput === String(amt) && styles.presetChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          amountInput === String(amt) && styles.presetTextActive,
                        ]}
                      >
                        {formatRwf(amt)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  style={styles.textInput}
                  value={amountInput}
                  onChangeText={(val) => {
                    setAmountInput(val);
                    const n = parseInt(val, 10);
                    if (!isNaN(n) && n < requiredPeriodAmount) {
                      setIsPartial(true);
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="Amount in RWF"
                  placeholderTextColor={theme.colors.textMuted}
                />

                <Pressable
                  style={styles.partialToggleRow}
                  onPress={() => setIsPartial(!isPartial)}
                >
                  <Text style={styles.partialToggleText}>
                    {isPartial || parseInt(amountInput, 10) < requiredPeriodAmount
                      ? `☑ ${t.payments.payingPartialLabel}`
                      : `☐ ${t.payments.payingPartialLabel}`}
                  </Text>
                </Pressable>

                {(isPartial || parseInt(amountInput, 10) < requiredPeriodAmount) && (
                  <>
                    <Text style={styles.inputLabel}>
                      {t.payments.partialReasonRequired}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={partialReason}
                      onChangeText={setPartialReason}
                      placeholder={t.payments.partialReasonPlaceholder}
                      placeholderTextColor={theme.colors.textMuted}
                    />
                  </>
                )}

                <Text style={styles.inputLabel}>{t.payments.momoPhoneLabel}</Text>
                <TextInput
                  style={styles.textInput}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  keyboardType="phone-pad"
                  placeholder="078XXXXXXX"
                  placeholderTextColor={theme.colors.textMuted}
                />

                {payError && <Text style={styles.errorText}>{payError}</Text>}

                <View style={styles.modalActions}>
                  <View style={styles.buttonHalf}>
                    <SecondaryButton label={t.common.cancel} onPress={handleCloseModal} />
                  </View>
                  <View style={styles.buttonHalf}>
                    <PrimaryButton
                      label={payMutation.isPending ? t.common.loading : t.payments.payNow}
                      onPress={handlePayPress}
                      disabled={payMutation.isPending}
                    />
                  </View>
                </View>
              </>
            ) : (
              /* Status / Polling UI */
              <View style={styles.statusBox}>
                {statusData?.status === 'SUCCESSFUL' ? (
                  <>
                    <Text style={styles.statusIcon}>✅</Text>
                    <Text style={styles.statusSuccessTitle}>
                      {t.payments.paymentReceivedTitle}
                    </Text>
                    <Text style={styles.statusDesc}>
                      {t.payments.paymentRecordedDesc.replace('{amount}', formatRwf(statusData.amount))}
                    </Text>
                    <View style={styles.fullWidthButton}>
                      <PrimaryButton label={t.common.done} onPress={handleCloseModal} />
                    </View>
                  </>
                ) : statusData?.status === 'FAILED' ? (
                  <>
                    <Text style={styles.statusIcon}>❌</Text>
                    <Text style={styles.statusFailedTitle}>Payment Failed</Text>
                    <Text style={styles.statusDesc}>
                      {statusData.failureReason ||
                        'The transaction was cancelled or rejected on your phone.'}
                    </Text>
                    <View style={styles.fullWidthButton}>
                      <SecondaryButton
                        label="Try Again"
                        onPress={() => setActiveRefId(null)}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.statusIcon}>📱</Text>
                    <Text style={styles.statusPendingTitle}>
                      Prompt Sent to {statusData?.payerPhone || phoneInput}
                    </Text>
                    <Text style={styles.statusDesc}>
                      Please check your phone screen and enter your Mobile Money PIN
                      to approve {formatRwf(parseInt(amountInput, 10))}.
                    </Text>
                    <Text style={styles.pollingText}>
                      Waiting for payment confirmation...
                    </Text>
                    <View style={styles.fullWidthButton}>
                      <SecondaryButton
                        label="Close Window"
                        onPress={handleCloseModal}
                      />
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  cardSubtitle: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
  },
  perDay: {
    fontSize: theme.typography.body,
    fontWeight: '400',
    color: theme.colors.textMuted,
  },
  progressContainer: {
    marginVertical: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.input,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  progressLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  subText: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginVertical: theme.spacing.md,
  },
  statBox: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.input,
  },
  statBoxDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statBoxLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  statBoxValue: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  textDanger: {
    color: theme.colors.danger,
  },
  payButtonWrapper: {
    marginTop: theme.spacing.md,
  },
  historyCardWrapper: {
    marginBottom: theme.spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLeft: {},
  historyAmount: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  historyDate: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyRef: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  emptyHistory: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  presetChip: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  presetChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  presetText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  presetTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.caption,
    marginVertical: theme.spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  buttonHalf: {
    flex: 1,
  },
  fullWidthButton: {
    marginTop: theme.spacing.md,
    width: '100%',
  },
  statusBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  statusSuccessTitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '700',
    color: theme.colors.success,
    marginBottom: 4,
  },
  statusFailedTitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '700',
    color: theme.colors.danger,
    marginBottom: 4,
  },
  statusPendingTitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  pollingText: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  partialToggleRow: {
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  partialToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.warning,
  },
  partialReasonText: {
    fontSize: 11,
    color: theme.colors.warning,
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
});
