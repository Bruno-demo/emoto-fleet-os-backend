import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type ForgotAccessScreenProps = NativeStackScreenProps<
  RiderAuthStackParamList,
  'ForgotAccess'
>;

// Collects the rider phone number before showing the recovery guidance screen.
export function ForgotAccessScreen({ navigation }: ForgotAccessScreenProps) {
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Validates the rider phone format before advancing to reset guidance.
  const continueToReset = () => {
    if (!phone.trim()) {
      setPhoneError('Enter the rider phone number tied to this account.');
      return;
    }

    if (phone.trim().length < 8) {
      setPhoneError('Enter the full rider phone number.');
      return;
    }

    setPhoneError(null);
    navigation.navigate('ResetAccess', { phone: phone.trim() });
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
        />
        <PrimaryButton label="Continue" onPress={continueToReset} />
        <SecondaryButton label="Back to login" onPress={() => navigation.goBack()} />
      </AppCard>

      <AppCard title="What happens next" subtitle="Password recovery is still fleet-assisted in this deployment.">
        <View style={styles.stepList}>
          <Text style={styles.stepText}>1. Confirm the phone number your fleet admin registered.</Text>
          <Text style={styles.stepText}>2. Ask dispatch or your fleet admin for a temporary password if needed.</Text>
          <Text style={styles.stepText}>3. Return to login and sign in again with the new password.</Text>
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
