import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { useLanguage } from '../lib/i18n/language-context';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type OtpHelpScreenProps = NativeStackScreenProps<RiderAuthStackParamList, 'OtpHelp'>;

// Explains the current sign-in mode so riders do not wait for an OTP that will never arrive.
export function OtpHelpScreen({ navigation }: OtpHelpScreenProps) {
  const { t } = useLanguage();
  return (
    <AuthShell
      eyebrow={t.auth.otpHelpEyebrow}
      title={t.auth.otpHelpScreenTitle}
      description={t.auth.otpHelpScreenDescription}
    >
      <AppCard
        title={t.auth.currentSignInModeCardTitle}
        subtitle={t.auth.currentSignInModeCardSub}
        rightSlot={<Badge label={t.auth.passwordFlowBadge} tone="primary" />}
      >
        <View style={styles.stepList}>
          <Text style={styles.stepText}>{t.auth.otpRule1}</Text>
          <Text style={styles.stepText}>{t.auth.otpRule2}</Text>
          <Text style={styles.stepText}>{t.auth.otpRule3}</Text>
        </View>
        <PrimaryButton label={t.auth.backToLoginButton} onPress={() => navigation.navigate('Login')} />
        <SecondaryButton label={t.auth.recoveryOptionsButton} onPress={() => navigation.navigate('ForgotAccess')} />
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
