import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth/auth-context';
import { AppCard } from './ui/card';
import { PrimaryButton, SecondaryButton } from './ui/button';
import { theme } from '../theme/tokens';

interface PendingSetupGateProps {
  isRefetching?: boolean;
  onRefresh: () => void;
}

export function PendingSetupGate({ isRefetching, onRefresh }: PendingSetupGateProps) {
  const auth = useAuth();

  if (auth.riderMe?.status !== 'PENDING_SETUP') {
    return null;
  }

  const chosenPlanLabel = auth.riderMe.plan === 'PREMIUM' ? 'Delivery Fleet Plan' : 'Cooperative & Individual Plan';

  return (
    <View style={styles.pendingContainer}>
      <Text style={styles.pendingIcon}>⚙️</Text>
      <Text style={styles.pendingTitle}>Hardware Installation Pending</Text>
      <Text style={styles.pendingText}>
        Your {auth.riderMe.isPersonalOwner ? 'personal owner' : 'rider'} profile has been created successfully on the <Text style={{ fontWeight: '800', color: theme.colors.primary }}>{chosenPlanLabel}</Text>, but your telemetry hardware node is pending installation.
      </Text>
      
      <AppCard title="What happens next" subtitle="Our team is preparing your hardware kit.">
        <View style={styles.stepList}>
          <Text style={styles.stepText}>1. E-Moto technicians will schedule your vehicle's device deployment.</Text>
          <Text style={styles.stepText}>2. The tracker is physically installed and calibrated on your bike.</Text>
          <Text style={styles.stepText}>3. HQ activates your account, enabling remote controls, mapping, and analytics instantly!</Text>
        </View>
      </AppCard>

      <View style={styles.pendingButtons}>
        <SecondaryButton 
          label={isRefetching ? 'Refreshing...' : 'Refresh status'} 
          onPress={onRefresh} 
          disabled={isRefetching}
        />
        <View style={{ height: theme.spacing.sm }} />
        <PrimaryButton label="Sign out" onPress={() => void auth.logout()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pendingContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  pendingIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
  },
  pendingTitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  pendingText: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  stepList: {
    gap: theme.spacing.sm,
  },
  stepText: {
    fontSize: theme.typography.body,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  pendingButtons: {
    width: '100%',
    marginTop: theme.spacing.md,
  },
});
