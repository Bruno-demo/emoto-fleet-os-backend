import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type OtpHelpScreenProps = NativeStackScreenProps<RiderAuthStackParamList, 'OtpHelp'>;

// Explains the current sign-in mode so riders do not wait for an OTP that will never arrive.
export function OtpHelpScreen({ navigation }: OtpHelpScreenProps) {
  return (
    <AuthShell
      eyebrow="OTP Help"
      title="This rider app signs in with phone and password"
      description="SMS OTP sign-in is not enabled in this deployment, so riders should use the password flow and fleet-assisted recovery."
    >
      <AppCard
        title="Current sign-in mode"
        subtitle="Use the same rider phone number and password that your fleet admin issued."
        rightSlot={<Badge label="Password flow" tone="primary" />}
      >
        <View style={styles.stepList}>
          <Text style={styles.stepText}>If your phone changed, ask your fleet admin to update the rider account.</Text>
          <Text style={styles.stepText}>If your password is missing, use the recovery flow to request a temporary password.</Text>
          <Text style={styles.stepText}>If login still fails, return to the login screen and confirm the full phone number format.</Text>
        </View>
        <PrimaryButton label="Back to login" onPress={() => navigation.navigate('Login')} />
        <SecondaryButton label="Recovery options" onPress={() => navigation.navigate('ForgotAccess')} />
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
