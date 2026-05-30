import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ConfirmModal } from '../components/ui/confirm-modal';
import { ErrorState } from '../components/ui/error-state';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ApiError, apiFetch } from '../lib/api/client';
import { riderSosResponseSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderSosResponse } from '../lib/types/api';
import { theme } from '../theme/tokens';
import { useAuth } from '../lib/auth/auth-context';
import { PendingSetupGate } from '../components/pending-setup-gate';

async function getCurrentCoordinates(): Promise<{ lat: number; lng: number } | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return null;
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

function toSosErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status >= 500) {
    return 'Dispatcher alert could not be sent right now. Try again immediately.';
  }
  if (error instanceof Error && error.message.toLowerCase().includes('network')) {
    return 'No network connection detected. Move to coverage and retry.';
  }
  if (error instanceof Error) return error.message;
  return 'SOS could not be sent right now. Try again immediately.';
}

export function SosScreen() {
  const auth = useAuth();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<RiderSosResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const submitSos = async (): Promise<void> => {
    setErrorMessage(null);
    setResponse(null);
    setIsSubmitting(true);
    try {
      const coordinates = await getCurrentCoordinates();
      const payload = await apiFetch<RiderSosResponse>(
        '/rider/sos',
        {
          method: 'POST',
          body: JSON.stringify({
            message: note.trim() || undefined,
            lat: coordinates?.lat,
            lng: coordinates?.lng,
          }),
        },
        { schema: riderSosResponseSchema },
      );
      setResponse(payload);
      setNote('');
    } catch (error: unknown) {
      logAppError('rider.sos_submit_failed', error, {
        feature: 'sos',
        operation: 'submit',
        status: error instanceof ApiError ? error.status : undefined,
      });
      setErrorMessage(toSosErrorMessage(error));
    } finally {
      setIsSubmitting(false);
      setConfirmVisible(false);
    }
  };

  if (auth.riderMe?.status === 'PENDING_SETUP') {
    return (
      <ScreenContainer
        refreshing={isSubmitting}
        onRefresh={() => {
          void auth.refreshRiderMe();
        }}
      >
        <PendingSetupGate
          isRefetching={isSubmitting}
          onRefresh={() => {
            void auth.refreshRiderMe();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <SectionHeader
        title="Emergency SOS"
        subtitle="Fleet assistance when you need it most"
      />

      {response ? (
        /* Success state */
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <Text style={styles.successIcon}>✅</Text>
          </View>
          <Text style={styles.successTitle}>Dispatcher Notified</Text>
          <Text style={styles.successSubtitle}>
            Your emergency alert was accepted and routed to fleet response.
          </Text>
          <View style={styles.successDetails}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Contacts notified</Text>
              <Text style={styles.successValue}>{response.notifiedContacts}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Reference</Text>
              <Text style={styles.successValue}>{response.event.id.slice(0, 12)}</Text>
            </View>
          </View>
          <PrimaryButton
            label="Send another SOS"
            onPress={() => {
              setResponse(null);
              setErrorMessage(null);
            }}
          />
        </View>
      ) : (
        <>
          {/* Big SOS button hero */}
          <View style={styles.sosHero}>
            <View style={styles.sosOuterRing}>
              <View style={styles.sosInnerRing}>
                <PrimaryButton
                  label={isSubmitting ? 'Sending...' : '🆘  SOS'}
                  loading={isSubmitting}
                  tone="danger"
                  onPress={() => setConfirmVisible(true)}
                />
              </View>
            </View>
            <Text style={styles.sosInstruction}>
              Tap to alert dispatch immediately
            </Text>
            <View style={styles.sosStatusRow}>
              <Badge label="Location auto-attached" tone="primary" />
              <Badge label="Instant dispatch" tone="warning" />
            </View>
          </View>

          {/* When to use guide */}
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>When to use SOS</Text>
            <View style={styles.guideItems}>
              {[
                { icon: '💥', text: 'Crash or collision' },
                { icon: '🚨', text: 'Personal danger or threat' },
                { icon: '🔒', text: 'Theft in progress' },
                { icon: '🏥', text: 'Medical emergency' },
              ].map((item) => (
                <View key={item.text} style={styles.guideItem}>
                  <Text style={styles.guideIcon}>{item.icon}</Text>
                  <Text style={styles.guideText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Optional note */}
          <AppCard title="Optional Note" subtitle="Help dispatch understand the situation">
            <InputField
              label="Message"
              hint={`${note.length}/500`}
              value={note}
              onChangeText={setNote}
              placeholder="What happened? Crash, medical, unsafe stop..."
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
            {note.length > 0 ? (
              <SecondaryButton label="Clear" onPress={() => setNote('')} />
            ) : null}
          </AppCard>

          {errorMessage ? (
            <ErrorState
              title="SOS not sent"
              description={errorMessage}
              retryLabel="Retry SOS"
              onRetry={() => setConfirmVisible(true)}
            />
          ) : null}
        </>
      )}

      <ConfirmModal
        visible={confirmVisible}
        title="Send emergency alert?"
        description="This will notify your dispatcher immediately and may trigger emergency contact workflows. Only continue if you need urgent help."
        confirmLabel="Yes, send SOS"
        confirmTone="danger"
        loading={isSubmitting}
        onCancel={() => {
          if (!isSubmitting) setConfirmVisible(false);
        }}
        onConfirm={() => {
          void submitSos();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sosHero: {
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: theme.radius.hero,
    backgroundColor: theme.colors.dangerSoft,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  sosOuterRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: theme.colors.dangerBorder,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosInnerRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sosInstruction: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  sosStatusRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  guideCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.md,
    ...theme.shadowLight,
  },
  guideTitle: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  guideItems: {
    gap: theme.spacing.md,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  guideIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
  },
  guideText: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  successCard: {
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    borderRadius: theme.radius.hero,
    backgroundColor: theme.colors.successSoft,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.successSoft,
    borderWidth: 2,
    borderColor: theme.colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    fontSize: 28,
  },
  successTitle: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
  },
  successSubtitle: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  successDetails: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  successDivider: {
    height: 1,
    backgroundColor: theme.colors.borderFaint,
  },
  successLabel: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  successValue: {
    fontSize: theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
});
