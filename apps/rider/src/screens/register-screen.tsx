import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthShell } from '../components/auth-shell';
import { InlineNotice } from '../components/ui/error-state';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ApiError, apiFetch } from '../lib/api/client';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type RegisterScreenProps = NativeStackScreenProps<RiderAuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [registerType, setRegisterType] = useState<'fleet' | 'self'>('fleet');
  const [selectedPlan, setSelectedPlan] = useState<'DEMO' | 'PREMIUM'>('DEMO');
  const [inviteCode, setInviteCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+250');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP verification state for email
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const validateForm = () => {
    let hasError = false;

    if (registerType === 'fleet') {
      if (!inviteCode.trim() || inviteCode.trim().length < 12) {
        setInviteCodeError('Enter the invite code from your fleet admin.');
        hasError = true;
      } else {
        setInviteCodeError(null);
      }
    } else {
      setInviteCodeError(null);
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      setFullNameError('Enter your full name.');
      hasError = true;
    } else {
      setFullNameError(null);
    }

    if (!phoneNumber.trim()) {
      setPhoneError('Enter your phone number.');
      hasError = true;
    } else if (phoneNumber.trim().length < 8) {
      setPhoneError('Phone number is too short.');
      hasError = true;
    } else {
      setPhoneError(null);
    }

    if (!password.trim() || password.trim().length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      hasError = true;
    } else {
      setPasswordError(null);
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      hasError = true;
    } else {
      setConfirmPasswordError(null);
    }

    // Email is now strictly required and must be verified with OTP
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Enter a valid email address.');
      hasError = true;
    } else if (!isEmailVerified) {
      setErrorMessage('Please verify your email address with the OTP first.');
      hasError = true;
    }

    return !hasError;
  };

  const handleSendOtp = async (): Promise<void> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await apiFetch<{ otp?: string }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail, reason: 'register' }),
      }, { auth: false });

      setIsOtpSent(true);
      if (res.otp) {
        setDevOtp(res.otp);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setOtpError(err.message);
      } else {
        setOtpError('Failed to send verification code.');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (): Promise<void> => {
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp: otpCode.trim(), reason: 'register' }),
      }, { auth: false });

      setIsEmailVerified(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setOtpError(err.message);
      } else {
        setOtpError('Invalid or expired verification code.');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleRegister = async (): Promise<void> => {
    if (!validateForm()) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const fullPhone = countryCode + phoneNumber.trim();

    try {
      if (registerType === 'fleet') {
        await apiFetch(
          '/auth/register-invite',
          {
            method: 'POST',
            body: JSON.stringify({
              token: inviteCode.trim(),
              email: email.trim(),
              phone: fullPhone,
              password: password,
            }),
          },
          { auth: false },
        );
      } else {
        await apiFetch(
          '/auth/register-self',
          {
            method: 'POST',
            body: JSON.stringify({
              fullName: fullName.trim(),
              email: email.trim(),
              phone: fullPhone,
              password: password,
              plan: selectedPlan,
            }),
          },
          { auth: false },
        );
      }

      if (registerType === 'self') {
        setSuccessMessage('Account created! Your hardware installation is pending. E-Moto HQ will activate your profile shortly.');
      } else {
        setSuccessMessage('Account created! You can now sign in with your credentials.');
      }
      // Clear form
      setInviteCode('');
      setFullName('');
      setPhoneNumber('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setIsOtpSent(false);
      setIsEmailVerified(false);
      setOtpCode('');

      // Navigate to login after a brief delay
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2500);
    } catch (error: unknown) {
      logAppError('rider.register_failed', error, {
        feature: 'auth',
        operation: 'register-invite',
        status: error instanceof ApiError ? error.status : undefined,
      });
      if (error instanceof ApiError) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email')) {
          setErrorMessage('This email address is already in use by another account.');
        } else if (msg.includes('phone')) {
          setPhoneError('This phone number is already in use by another account.');
          setErrorMessage('This phone number is already in use by another account.');
        } else {
          setErrorMessage(error.message);
        }
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to create your account right now.');
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
        title={registerType === 'fleet' ? 'Join your fleet.' : 'Register as Owner.'}
        description={
          registerType === 'fleet'
            ? 'Use the invite code from your fleet admin to create your rider account.'
            : 'Register your personal bike and start driving independently.'
        }
      >
        {/* Registration form card */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Create Account</Text>
            <Badge label={registerType === 'fleet' ? 'Invite' : 'Self Owner'} tone="primary" />
          </View>

          {/* Registration Type Selector Segmented Control */}
          <View style={styles.segmentContainer}>
            <Pressable
              onPress={() => setRegisterType('fleet')}
              style={[
                styles.segmentButton,
                registerType === 'fleet' ? styles.segmentButtonActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  registerType === 'fleet' ? styles.segmentButtonTextActive : null,
                ]}
              >
                Join Fleet
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setRegisterType('self')}
              style={[
                styles.segmentButton,
                registerType === 'self' ? styles.segmentButtonActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  registerType === 'self' ? styles.segmentButtonTextActive : null,
                ]}
              >
                Self Bike Owner
              </Text>
            </Pressable>
          </View>

          {/* Plan Selector for Self Bike Owner */}
          {registerType === 'self' && (
            <View style={styles.planSelectorWrap}>
              <Text style={styles.label}>Choose Your Plan</Text>
              <View style={styles.planCardsRow}>
                <Pressable
                  onPress={() => setSelectedPlan('DEMO')}
                  style={[
                    styles.planCard,
                    selectedPlan === 'DEMO' ? styles.planCardActive : null,
                  ]}
                >
                  <Text style={styles.planIcon}>🛡️</Text>
                  <Text
                    style={[
                      styles.planTitle,
                      selectedPlan === 'DEMO' ? styles.planTitleActive : null,
                    ]}
                  >
                    Co-op & Individual
                  </Text>
                  <Text style={styles.planDetail}>
                    Full live map & remote commands.
                  </Text>
                  <Text style={styles.planPrice}>10K RWF/mo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedPlan('PREMIUM')}
                  style={[
                    styles.planCard,
                    selectedPlan === 'PREMIUM' ? styles.planCardActive : null,
                  ]}
                >
                  <Text style={styles.planIcon}>⚡</Text>
                  <Text
                    style={[
                      styles.planTitle,
                      selectedPlan === 'PREMIUM' ? styles.planTitleActive : null,
                    ]}
                  >
                    Delivery Fleet
                  </Text>
                  <Text style={styles.planDetail}>
                    Adds delivery dispatch & reports.
                  </Text>
                  <Text style={styles.planPrice}>15K RWF/mo</Text>
                </Pressable>
              </View>
            </View>
          )}

          {successMessage ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? <InlineNotice description={errorMessage} /> : null}

          {registerType === 'fleet' ? (
            <InputField
              label="Invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              error={inviteCodeError}
              placeholder="Paste the invite code from your admin"
              autoCapitalize="none"
              autoComplete="off"
            />
          ) : null}

          <InputField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            error={fullNameError}
            placeholder="e.g. Aisha Niyonzima"
            autoCapitalize="words"
            autoComplete="name"
          />

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
            label="Phone number"
            value={phoneNumber}
            onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, ''))}
            error={phoneError}
            placeholder="e.g. 788123456"
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoComplete="tel"
          />

          <InputField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setIsOtpSent(false);
              setIsEmailVerified(false);
              setOtpCode('');
              setDevOtp(null);
              setOtpError(null);
            }}
            hint={isEmailVerified ? '✓ Verified' : undefined}
            placeholder="rider@fleet.co"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          {/* Send OTP button for email verification */}
          {email.trim().length > 0 && !isEmailVerified && !isOtpSent && (
            <PrimaryButton
              label={isSendingOtp ? 'Sending code...' : 'Verify email'}
              loading={isSendingOtp}
              onPress={() => { void handleSendOtp(); }}
            />
          )}

          {/* OTP Verification section */}
          {isOtpSent && !isEmailVerified && (
            <View style={styles.otpCard}>
              <View style={styles.otpHeader}>
                <Text style={styles.otpTitle}>Email Verification</Text>
                {devOtp ? (
                  <View style={styles.devOtpBadge}>
                    <Text style={styles.devOtpText}>Dev OTP: {devOtp}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.otpDescription}>
                We sent a 6-digit code to {email}. Enter it below.
              </Text>
              <InputField
                label="Verification code"
                value={otpCode}
                onChangeText={(text) => setOtpCode(text.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
              {otpError ? <InlineNotice description={otpError} /> : null}
              <PrimaryButton
                label={isVerifyingOtp ? 'Verifying...' : 'Verify code'}
                loading={isVerifyingOtp}
                disabled={otpCode.length !== 6}
                onPress={() => { void handleVerifyOtp(); }}
              />
              <Pressable
                onPress={() => { void handleSendOtp(); }}
                disabled={isSendingOtp}
                style={styles.resendRow}
              >
                <Text style={styles.resendText}>
                  {isSendingOtp ? 'Sending...' : "Didn't receive it? Resend code"}
                </Text>
              </Pressable>
            </View>
          )}

          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            placeholder="Minimum 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />

          <InputField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={confirmPasswordError}
            placeholder="Re-enter password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />

          <PrimaryButton
            label={isSubmitting ? 'Creating account...' : 'Create account'}
            loading={isSubmitting}
            onPress={() => { void handleRegister(); }}
          />
        </View>

        {/* Back to login */}
        <View style={styles.helpCard}>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.helpLink, pressed ? styles.helpLinkPressed : null]}
          >
            <Text style={styles.helpIcon}>🔑</Text>
            <View style={styles.helpLinkText}>
              <Text style={styles.helpLinkTitle}>Already have an account?</Text>
              <Text style={styles.helpLinkSub}>Go back to sign in with your credentials</Text>
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
  successContainer: {
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.successSoft,
    paddingHorizontal: theme.layout.itemPaddingX,
    paddingVertical: theme.spacing.md,
  },
  successText: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.success,
    fontWeight: '600',
  },
  otpCard: {
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.primaryGlow,
    padding: theme.layout.cardPadding,
    gap: theme.layout.inlineGap,
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otpTitle: {
    fontSize: theme.typography.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.primary,
  },
  otpDescription: {
    fontSize: theme.typography.small,
    lineHeight: theme.typography.lineHeight.small,
    color: theme.colors.textSecondary,
  },
  devOtpBadge: {
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.warningSoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  devOtpText: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.warning,
  },
  resendRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  resendText: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  helpCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadowLight,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.cardPadding,
    paddingVertical: theme.spacing.lg,
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.input,
    padding: 4,
    marginBottom: theme.spacing.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.input - 2,
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadowLight,
  },
  segmentButtonText: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  segmentButtonTextActive: {
    color: theme.colors.text,
    fontWeight: '800',
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
  planSelectorWrap: {
    gap: theme.layout.textGap,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  planCardsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  planCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    gap: 4,
  },
  planCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  planIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  planTitle: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  planTitleActive: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  planDetail: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
  },
  planPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 4,
  },
});
