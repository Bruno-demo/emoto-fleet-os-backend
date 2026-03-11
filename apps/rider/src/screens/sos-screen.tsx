import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ConfirmModal } from '../components/ui/confirm-modal';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ApiError, apiFetch } from '../lib/api/client';
import { riderSosResponseSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderSosResponse } from '../lib/types/api';
import { theme } from '../theme/tokens';

// Captures current coordinates only when foreground location permission is granted.
async function getCurrentCoordinates(): Promise<{ lat: number; lng: number } | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

// Maps network and permission failures into rider-facing SOS messages.
function toSosErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status >= 500) {
    return 'Dispatcher alert could not be sent right now. Try again immediately.';
  }

  if (error instanceof Error && error.message.toLowerCase().includes('network')) {
    return 'No network connection was detected. Move to coverage and retry the SOS alert.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'SOS could not be sent right now. Try again immediately.';
}

// Provides SOS confirmation flow and submits emergency requests to the backend.
export function SosScreen() {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<RiderSosResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Sends SOS to the backend after optional location acquisition and explicit confirmation.
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

  return (
    <ScreenContainer>
      <SectionHeader
        title="SOS"
        subtitle="Use this only when you need immediate fleet assistance."
      />

      {response ? (
        <AppCard
          title="Dispatcher notified"
          subtitle="Your emergency alert was accepted and routed to the fleet response workflow."
          rightSlot={<Badge label="Sent" tone="success" />}
        >
          <Text style={styles.successText}>
            Contacts notified: {response.notifiedContacts}
          </Text>
          <Text style={styles.successText}>
            Reference event: {response.event.id}
          </Text>
          <PrimaryButton
            label="Send another SOS"
            onPress={() => {
              setResponse(null);
              setErrorMessage(null);
            }}
          />
        </AppCard>
      ) : (
        <>
          <AppCard
            title="Emergency alert"
            subtitle="Press SOS only if you need urgent support. A dispatcher and configured emergency contacts will be notified."
          >
            <View style={styles.sosHero}>
              <Text style={styles.sosEyebrow}>Hold steady and confirm</Text>
              <Text style={styles.sosTitle}>Tap once, then confirm to notify dispatch.</Text>
              <PrimaryButton
                label={isSubmitting ? 'Sending SOS...' : 'Send SOS'}
                loading={isSubmitting}
                tone="danger"
                onPress={() => setConfirmVisible(true)}
              />
            </View>
            <Badge label="Location is attached when permission is available" tone="warning" />
          </AppCard>

          <AppCard title="Optional note" subtitle="Share a short message so dispatch knows what happened.">
            <InputField
              label="Message"
              hint={`${note.length}/500`}
              value={note}
              onChangeText={setNote}
              placeholder="Crash, medical issue, unsafe stop, or other emergency details"
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <SecondaryButton label="Clear note" onPress={() => setNote('')} disabled={!note} />
          </AppCard>

          {errorMessage ? (
            <ErrorState
              title="SOS not sent"
              description={errorMessage}
              retryLabel="Retry SOS"
              onRetry={() => setConfirmVisible(true)}
            />
          ) : null}

          <EmptyState
            title="When to use SOS"
            description="Use SOS for crash response, personal danger, theft in progress, or a situation where dispatch must react immediately."
          />
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
          if (!isSubmitting) {
            setConfirmVisible(false);
          }
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
    borderColor: '#F1C9C4',
    borderRadius: theme.radius.hero,
    backgroundColor: theme.colors.dangerSoft,
    padding: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  sosEyebrow: {
    fontSize: theme.typography.caption,
    fontWeight: '800',
    color: theme.colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sosTitle: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    lineHeight: 28,
    color: theme.colors.text,
  },
  successText: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
});
