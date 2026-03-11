import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type ResetAccessScreenProps = NativeStackScreenProps<
  RiderAuthStackParamList,
  'ResetAccess'
>;

// Shows the rider-safe reset guidance that matches the current backend capabilities.
export function ResetAccessScreen({
  navigation,
  route,
}: ResetAccessScreenProps) {
  const phone = route.params?.phone ?? 'your rider phone';

  return (
    <AuthShell
      eyebrow="Reset Access"
      title="Use a fleet-issued temporary password"
      description="Self-service reset is not active yet, so the next safe step is to request help from dispatch or your fleet admin."
    >
      <AppCard
        title="Recovery summary"
        subtitle="Use the number below when you contact your fleet admin."
        rightSlot={<Badge label="Help flow" tone="warning" />}
      >
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rider phone</Text>
          <Text style={styles.summaryValue}>{phone}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>What to ask for</Text>
          <Text style={styles.summaryValue}>Temporary password or account unlock</Text>
        </View>
      </AppCard>

      <AppCard title="Next steps" subtitle="Once your fleet admin updates the account, return to login with the new password.">
        <View style={styles.stepList}>
          <Text style={styles.stepText}>1. Contact dispatch or your fleet admin.</Text>
          <Text style={styles.stepText}>2. Confirm the rider phone shown above.</Text>
          <Text style={styles.stepText}>3. Ask for a temporary password or account unlock.</Text>
          <Text style={styles.stepText}>4. Return to login and sign in again.</Text>
        </View>
        <PrimaryButton label="Back to login" onPress={() => navigation.navigate('Login')} />
        <SecondaryButton label="OTP help" onPress={() => navigation.navigate('OtpHelp')} />
      </AppCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    gap: theme.spacing.xs,
  },
  summaryLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  summaryValue: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  stepList: {
    gap: theme.spacing.sm,
  },
  stepText: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
});
