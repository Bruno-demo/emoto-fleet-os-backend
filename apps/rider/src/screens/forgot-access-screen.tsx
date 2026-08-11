import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { useLanguage } from '../lib/i18n/language-context';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';
import { ApiError, apiFetch } from '../lib/api/client';

type ForgotAccessScreenProps = NativeStackScreenProps<
  RiderAuthStackParamList,
  'ForgotAccess'
>;

// Collects the rider phone number before showing the recovery guidance screen.
export function ForgotAccessScreen({ navigation }: ForgotAccessScreenProps) {
  const { t } = useLanguage();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validates the rider phone format and requests a reset token.
  const continueToReset = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setPhoneError('Enter your phone number or email.');
      return;
    }

    if (!trimmed.includes('@')) {
      if (!trimmed.startsWith('+')) {
        setPhoneError('Include country code starting with + (e.g. +250788123456)');
        return;
      }
      if (trimmed.replace(/\D/g, '').length < 8) {
        setPhoneError('Enter a valid phone number with country code.');
        return;
      }
    }

    const finalIdentifier = trimmed.includes('@')
      ? trimmed
      : '+' + trimmed.replace(/\D/g, '');

    setPhoneError(null);
    setIsSubmitting(true);

    try {
      const res = await apiFetch<{ message: string; token?: string }>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ identifier: finalIdentifier }),
        },
        { auth: false },
      );

      navigation.navigate('ResetAccess', {
        phone: finalIdentifier,
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
      eyebrow={t.auth.recoveryEyebrow}
      title={t.auth.recoveryTitle}
      description={t.auth.recoveryDescription}
    >
      <AppCard
        title={t.auth.checkPhoneCardTitle}
        subtitle={t.auth.checkPhoneCardSub}
      >
        <InputField
          label={t.auth.identifierFieldLabel}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          error={phoneError}
          placeholder={t.auth.identifierFieldPlaceholder}
          keyboardType="email-address"
          editable={!isSubmitting}
        />
        <PrimaryButton
          label={t.auth.continueButton}
          onPress={continueToReset}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
        <SecondaryButton
          label={t.auth.backToLoginButton}
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
        />
      </AppCard>

      <AppCard title={t.auth.whatHappensNextTitle} subtitle={t.auth.whatHappensNextSub}>
        <View style={styles.stepList}>
          <Text style={styles.stepText}>{t.auth.step1Text}</Text>
          <Text style={styles.stepText}>{t.auth.step2Text}</Text>
          <Text style={styles.stepText}>{t.auth.step3Text}</Text>
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
  countrySelectorWrap: {
    gap: theme.layout.textGap,
    marginBottom: theme.spacing.xs,
  },
  countryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceRaised,
  },
  countryBadgeActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  countryCodeTextActive: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  label: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
