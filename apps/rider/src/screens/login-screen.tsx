import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { InlineNotice } from '../components/ui/error-state';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ApiError } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type LoginScreenProps = NativeStackScreenProps<RiderAuthStackParamList, 'Login'>;

// Collects rider phone/password and initiates authenticated session flow.
export function LoginScreen({ navigation }: LoginScreenProps) {
  const auth = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validates rider login fields before the network request is sent.
  const validateForm = () => {
    let hasError = false;

    if (!phone.trim()) {
      setPhoneError('Enter your rider phone number.');
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

  // Performs rider login using phone/password and maps failures to UI-safe text.
  const handleLogin = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await auth.login(phone.trim(), password);
    } catch (error: unknown) {
      logAppError('rider.login_failed', error, {
        feature: 'auth',
        operation: 'login',
        status: error instanceof ApiError ? error.status : undefined,
      });
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage('Your phone or password does not match a rider account.');
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
        eyebrow="Rider Access"
        title="Sign in fast, even on the roadside."
        description="Use your rider phone number and password. Recovery help is available below if you are locked out."
      >
        <AppCard
          title="Rider login"
          subtitle="Phone + password is the active sign-in flow for this deployment."
          rightSlot={<Badge label="Secure" tone="primary" />}
        >
          <InputField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            error={phoneError}
            placeholder="+250700000101"
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoComplete="tel"
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

          <View style={styles.linkRow}>
            <Pressable onPress={() => navigation.navigate('ForgotAccess')}>
              <Text style={styles.linkText}>Forgot access?</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('OtpHelp')}>
              <Text style={styles.linkText}>OTP help</Text>
            </Pressable>
          </View>
        </AppCard>

        <AppCard
          title="Quick recovery"
          subtitle="Use these help flows if your password is missing or your phone access changed."
        >
          <SecondaryButton
            label="Recovery options"
            onPress={() => navigation.navigate('ForgotAccess')}
          />
        </AppCard>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
