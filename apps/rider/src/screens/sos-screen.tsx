import * as Location from 'expo-location';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { ApiError, apiFetch } from '../lib/api/client';
import { riderSosResponseSchema } from '../lib/api/schemas';
import type { RiderSosResponse } from '../lib/types/api';

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

// Provides SOS confirmation flow and submits emergency requests to backend.
export function SosScreen() {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<RiderSosResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sends SOS to backend after optional location acquisition and user confirmation.
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
            message: message.trim() || undefined,
            lat: coordinates?.lat,
            lng: coordinates?.lng,
          }),
        },
        { schema: riderSosResponseSchema },
      );

      setResponse(payload);
      setMessage('');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to send SOS');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Requests user confirmation before dispatching emergency SOS.
  const confirmSos = (): void => {
    Alert.alert(
      'Send SOS?',
      'This will notify emergency contacts in your fleet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => {
            void submitSos();
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>SOS</Text>
      <Text style={styles.subtitle}>
        Trigger emergency assistance and notify configured contacts.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Optional message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          style={styles.messageInput}
          placeholder="Describe what happened"
          multiline
          numberOfLines={4}
          maxLength={500}
        />

        <Pressable
          style={[styles.sosButton, isSubmitting ? styles.sosButtonDisabled : null]}
          disabled={isSubmitting}
          onPress={confirmSos}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.sosButtonText}>Send SOS</Text>
          )}
        </Pressable>
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {response ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>SOS sent</Text>
          <Text style={styles.successText}>
            Notified contacts: {response.notifiedContacts}
          </Text>
          <Text style={styles.successText}>
            Event ID: {response.event.id.slice(0, 8)}
          </Text>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  messageInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  sosButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
  },
  sosButtonDisabled: {
    opacity: 0.8,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  successCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    padding: 12,
    gap: 4,
  },
  successTitle: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '700',
  },
  successText: {
    color: '#14532d',
    fontSize: 13,
  },
});
