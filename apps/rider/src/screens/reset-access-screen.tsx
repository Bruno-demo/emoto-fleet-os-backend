import { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';
import { ApiError, apiFetch } from '../lib/api/client';

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
  const initialToken = route.params?.token ?? '';

  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync token from route params if it changes (e.g. on new request)
  useEffect(() => {
    if (route.params?.token) {
      setToken(route.params.token);
    }
  }, [route.params?.token]);

  const handleReset = async () => {
    let hasError = false;
    
    if (!token.trim()) {
      setTokenError('Enter the 6-character reset token.');
      hasError = true;
    } else {
      setTokenError(null);
    }

    if (!password.trim()) {
      setPasswordError('Enter your new password.');
      hasError = true;
    } else if (password.trim().length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      hasError = true;
    } else {
      setPasswordError(null);
    }

    if (hasError) return;

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      await apiFetch(
        '/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            token: token.trim().toUpperCase(),
            password: password.trim(),
          }),
        },
        { auth: false },
      );

      setIsSuccess(true);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError('Failed to reset password. Please check connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthShell
        eyebrow="Success"
        title="Password reset complete"
        description="Your rider account password has been successfully updated."
      >
        <AppCard
          title="Account ready"
          subtitle="You can now sign in with your new secure credentials."
          rightSlot={<Badge label="Active" tone="success" />}
        >
          <PrimaryButton
            label="Back to login"
            onPress={() => navigation.navigate('Login')}
          />
        </AppCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Reset Access"
      title="Create your new password"
      description="Enter the secure alphanumeric token and choose a strong new password."
    >
      <AppCard
        title="Recovery summary"
        subtitle="Verification context for the password update."
        rightSlot={<Badge label="Self-Service" tone="primary" />}
      >
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rider phone</Text>
          <Text style={styles.summaryValue}>{phone}</Text>
        </View>
      </AppCard>

      <AppCard title="Reset credentials" subtitle="Choose a password with at least 8 characters.">
        <InputField
          label="Reset token"
          value={token}
          onChangeText={setToken}
          error={tokenError}
          placeholder="e.g. ABC123"
          autoCapitalize="characters"
          editable={!isSubmitting}
        />
        
        <InputField
          label="New password"
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          placeholder="••••••••"
          secureTextEntry
          editable={!isSubmitting}
        />

        {generalError ? (
          <Text style={styles.generalErrorText}>{generalError}</Text>
        ) : null}

        <PrimaryButton
          label="Reset Password"
          onPress={handleReset}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
        <SecondaryButton
          label="Cancel"
          onPress={() => navigation.navigate('Login')}
          disabled={isSubmitting}
        />
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
  generalErrorText: {
    fontSize: theme.typography.caption,
    lineHeight: theme.typography.lineHeight.caption,
    color: theme.colors.danger,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
});
