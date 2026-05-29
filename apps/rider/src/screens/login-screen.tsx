import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { InlineNotice } from '../components/ui/error-state';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ApiError } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type LoginScreenProps = NativeStackScreenProps<RiderAuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: LoginScreenProps) {
  const auth = useAuth();
  const [countryCode, setCountryCode] = useState('+250');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    let hasError = false;
    if (!phoneNumber.trim()) {
      setPhoneError('Enter your phone number or email.');
      hasError = true;
    } else {
      setPhoneError(null);
    }
    if (!password.trim()) {
      setPasswordError('Enter your password.');
      hasError = true;
    } else if (password.trim().length < 6) {
      setPasswordError('Use the full password issued for your rider account.');
      hasError = true;
    } else {
      setPasswordError(null);
    }
    return !hasError;
  };

  const handleLogin = async (): Promise<void> => {
    if (!validateForm()) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    const trimmedInput = phoneNumber.trim();
    const finalIdentifier = trimmedInput.includes('@')
      ? trimmedInput
      : countryCode + trimmedInput.replace(/\D/g, '');

    try {
      await auth.login(finalIdentifier, password);
    } catch (error: unknown) {
      logAppError('rider.login_failed', error, {
        feature: 'auth',
        operation: 'login',
        status: error instanceof ApiError ? error.status : undefined,
      });
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage('Phone or password does not match a rider account.');
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to sign you in right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <AuthShell
        eyebrow="eMoto Fleet"
        title="Welcome back, rider."
        description="Sign in with your phone and password to access your dashboard, trips, and coaching."
      >
        {/* Login form card */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Sign In</Text>
            <Badge label="Secure" tone="primary" />
          </View>

          {/* Country Code Selector */}
          <View style={styles.countrySelectorWrap}>
            <Text style={styles.label}>Country Code</Text>
            <View style={styles.countryRow}>
              {[
                { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
                { code: '+254', flag: '🇰🇪', name: 'Kenya' },
                { code: '+256', flag: '🇺🇬', name: 'Uganda' },
                { code: '+255', flag: '🇹🇿', name: 'Tanzania' },
                { code: '+257', flag: '🇧🇮', name: 'Burundi' },
              ].map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => setCountryCode(c.code)}
                  style={[
                    styles.countryBadge,
                    countryCode === c.code ? styles.countryBadgeActive : null,
                  ]}
                >
                  <Text style={styles.countryFlag}>{c.flag}</Text>
                  <Text
                    style={[
                      styles.countryCodeText,
                      countryCode === c.code ? styles.countryCodeTextActive : null,
                    ]}
                  >
                    {c.code}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <InputField
            label="Phone number or Email"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            error={phoneError}
            placeholder="e.g. 788123456"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="username"
          />
          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          {errorMessage ? <InlineNotice description={errorMessage} /> : null}

          <PrimaryButton
            label={isSubmitting ? 'Signing in...' : 'Sign in'}
            loading={isSubmitting}
            onPress={() => {
              void handleLogin();
            }}
          />
        </View>

        {/* Help links */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need help?</Text>
          <Pressable
            onPress={() => navigation.navigate('ForgotAccess')}
            style={({ pressed }) => [styles.helpLink, pressed ? styles.helpLinkPressed : null]}
          >
            <Text style={styles.helpIcon}>🔑</Text>
            <View style={styles.helpLinkText}>
              <Text style={styles.helpLinkTitle}>Forgot access</Text>
              <Text style={styles.helpLinkSub}>Reset your password or recover your account</Text>
            </View>
            <Text style={styles.helpChevron}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('OtpHelp')}
            style={({ pressed }) => [styles.helpLink, pressed ? styles.helpLinkPressed : null]}
          >
            <Text style={styles.helpIcon}>💬</Text>
            <View style={styles.helpLinkText}>
              <Text style={styles.helpLinkTitle}>OTP help</Text>
              <Text style={styles.helpLinkSub}>Questions about password-based sign-in</Text>
            </View>
            <Text style={styles.helpChevron}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [styles.helpLink, pressed ? styles.helpLinkPressed : null]}
          >
            <Text style={styles.helpIcon}>📋</Text>
            <View style={styles.helpLinkText}>
              <Text style={styles.helpLinkTitle}>Register with invite code</Text>
              <Text style={styles.helpLinkSub}>Got an invite from your fleet admin? Create your account</Text>
            </View>
            <Text style={styles.helpChevron}>›</Text>
          </Pressable>
        </View>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  formCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    gap: theme.layout.inlineGap,
    ...theme.shadow,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  formTitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '800',
    color: theme.colors.text,
  },
  helpCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadowLight,
  },
  helpTitle: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.layout.cardPadding,
    paddingTop: theme.layout.cardPadding,
    paddingBottom: theme.spacing.sm,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.cardPadding,
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderFaint,
  },
  helpLinkPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  helpIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
  },
  helpLinkText: {
    flex: 1,
    gap: 2,
  },
  helpLinkTitle: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  helpLinkSub: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  helpChevron: {
    fontSize: 22,
    fontWeight: '300',
    color: theme.colors.textMuted,
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
