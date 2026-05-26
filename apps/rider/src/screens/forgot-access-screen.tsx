import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';
import { ApiError, apiFetch } from '../lib/api/client';

type ForgotAccessScreenProps = NativeStackScreenProps<
  RiderAuthStackParamList,
  'ForgotAccess'
>;

// Collects the rider phone number before showing the recovery guidance screen.
export function ForgotAccessScreen({ navigation }: ForgotAccessScreenProps) {
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validates the rider phone format and requests a reset token.
  const continueToReset = async () => {
    if (!phone.trim()) {
      setPhoneError('Enter the rider phone number tied to this account.');
      return;
    }

    if (phone.trim().length < 8) {
      setPhoneError('Enter the full rider phone number.');
      return;
    }

    setPhoneError(null);
    setIsSubmitting(true);

    try {
      const res = await apiFetch<{ message: string; token?: string }>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ identifier: phone.trim() }),
        },
        { auth: false },
      );

      navigation.navigate('ResetAccess', {
        phone: phone.trim(),
        token: res.token,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setPhoneError(error.message);
      } else {
        setPhoneError('Failed to request reset token. Please check connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Recover your rider access"
      description="We will guide you to the safest next step without exposing technical details."
    >
      <AppCard
        title="Check your rider phone"
        subtitle="Start with the phone number registered by your fleet admin."
      >
        <InputField
          label="Rider phone"
          value={phone}
          onChangeText={setPhone}
          error={phoneError}
          placeholder="+250700000101"
          keyboardType="phone-pad"
          editable={!isSubmitting}
        />
        <PrimaryButton
          label="Continue"
          onPress={continueToReset}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
        <SecondaryButton
          label="Back to login"
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
        />
      </AppCard>

      <AppCard title="What happens next" subtitle="Password recovery is now self-service for your account.">
        <View style={styles.stepList}>
          <Text style={styles.stepText}>1. Confirm the phone number your fleet admin registered.</Text>
          <Text style={styles.stepText}>2. Enter the 6-character reset token sent to your device.</Text>
          <Text style={styles.stepText}>3. Choose a new secure password to access your rider profile.</Text>
        </View>
      </AppCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  stepList: {
    gap: theme.spacing.sm,
  },
  stepText: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
});
