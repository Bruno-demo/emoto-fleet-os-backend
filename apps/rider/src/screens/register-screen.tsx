import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { AuthShell } from '../components/auth-shell';
import { InlineNotice } from '../components/ui/error-state';
import { InputField } from '../components/ui/input-field';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ApiError, apiFetch } from '../lib/api/client';
import { useLanguage } from '../lib/i18n/language-context';
import { logAppError } from '../lib/monitoring/error-log';
import type { RiderAuthStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type RegisterScreenProps = NativeStackScreenProps<RiderAuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { t } = useLanguage();
  const [inviteCode, setInviteCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Image uploads (base64 data URIs)
  const [passportPhoto, setPassportPhoto] = useState<string | null>(null);
  const [identityCardPhoto, setIdentityCardPhoto] = useState<string | null>(null);
  const [licencePhoto, setLicencePhoto] = useState<string | null>(null);

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

  const pickImage = async (setter: (uri: string) => void) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setErrorMessage('Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          setter(`data:${mimeType};base64,${asset.base64}`);
        } else if (asset.uri) {
          setter(asset.uri);
        }
      }
    } catch (err) {
      logAppError('rider.pick_image_failed', err, { feature: 'auth' });
    }
  };

  const validateForm = () => {
    let hasError = false;

    if (!inviteCode.trim()) {
      setInviteCodeError(t.auth.fleetCodeLabel);
      hasError = true;
    } else {
      setInviteCodeError(null);
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      setFullNameError(t.auth.fullNameLabel);
      hasError = true;
    } else {
      setFullNameError(null);
    }

    // Strict 10-digit Rwandan phone number check (078..., 079..., 072..., 073...)
    const cleanPhone = phoneNumber.trim();
    const rwandaPhoneRegex = /^07[2389]\d{7}$/;
    if (!cleanPhone) {
      setPhoneError(t.auth.phoneLabel);
      hasError = true;
    } else if (!rwandaPhoneRegex.test(cleanPhone)) {
      setPhoneError(t.auth.phoneLabel);
      hasError = true;
    } else {
      setPhoneError(null);
    }

    if (!password.trim() || password.trim().length < 8) {
      setPasswordError(t.auth.passwordLabel);
      hasError = true;
    } else {
      setPasswordError(null);
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError(t.auth.passwordLabel);
      hasError = true;
    } else {
      setConfirmPasswordError(null);
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage(t.auth.emailLabel);
      hasError = true;
    } else if (!isEmailVerified) {
      setErrorMessage(t.auth.otpSub);
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
      logAppError('rider.send_otp_failed', err, { feature: 'auth' });
      setOtpError('Failed to send OTP code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (): Promise<void> => {
    if (!otpCode.trim()) {
      setOtpError('Enter OTP code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: otpCode.trim(),
          reason: 'register',
        }),
      }, { auth: false });

      setIsEmailVerified(true);
      setDevOtp(null);
    } catch (err: unknown) {
      logAppError('rider.verify_otp_failed', err, { feature: 'auth' });
      setOtpError('Invalid OTP code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleRegister = async (): Promise<void> => {
    if (!validateForm()) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await apiFetch<{ success: boolean; riderId: string }>(
        '/auth/register-rider',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inviteCode: inviteCode.trim(),
            fullName: fullName.trim(),
            phone: phoneNumber.trim(),
            email: email.trim() || undefined,
            identityNumber: identityNumber.trim() || undefined,
            licenceNumber: licenceNumber.trim() || undefined,
            password,
            passportPhoto: passportPhoto || undefined,
            identityCardPhoto: identityCardPhoto || undefined,
            licencePhoto: licencePhoto || undefined,
          }),
        },
        { auth: false },
      );

      setSuccessMessage('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1500);
    } catch (error: unknown) {
      logAppError('rider.register_failed', error, { feature: 'auth' });
      if (error instanceof ApiError) {
        if (error.status === 400 && error.details && typeof error.details === 'object') {
          const bodyObj = error.details as { message?: string | string[] };
          if (Array.isArray(bodyObj.message)) {
            setErrorMessage(bodyObj.message.join(' '));
          } else if (typeof bodyObj.message === 'string') {
            setErrorMessage(bodyObj.message);
          } else {
            setErrorMessage('Invalid inputs. Check code and fields.');
          }
        } else {
          setErrorMessage(error.message);
        }
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to create your rider account right now.');
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
        eyebrow="eMoto Fleet Rider"
        title={t.auth.registerTitle}
        description={t.auth.welcomeSub}
      >
        {/* Registration form card */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{t.auth.registerTitle}</Text>
            <Badge label="Code" tone="primary" />
          </View>

          {successMessage ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? <InlineNotice description={errorMessage} /> : null}

          {/* Invitation Code from Fleet Admin */}
          <InputField
            label="Invitation code *"
            value={inviteCode}
            onChangeText={setInviteCode}
            error={inviteCodeError}
            placeholder="e.g. invite_abcdef123456"
            autoCapitalize="none"
            autoComplete="off"
          />

          {/* Full Name */}
          <InputField
            label="Full name *"
            value={fullName}
            onChangeText={setFullName}
            error={fullNameError}
            placeholder="e.g. Aisha Niyonzima"
            autoCapitalize="words"
            autoComplete="name"
          />

          {/* 10-Digit Phone Number */}
          <InputField
            label="Phone number (10 Digits) *"
            value={phoneNumber}
            onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, '').slice(0, 10))}
            error={phoneError}
            placeholder="e.g. 0788123456"
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoComplete="tel"
          />

          {/* Email Address */}
          <InputField
            label="Email address *"
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

          {/* National ID / Passport Number */}
          <InputField
            label="National ID / Identity Number (Optional)"
            value={identityNumber}
            onChangeText={setIdentityNumber}
            placeholder="e.g. 1199880011223344"
            autoCapitalize="none"
            autoComplete="off"
          />

          {/* Driver's License Number */}
          <InputField
            label="Driver's License Number (Optional)"
            value={licenceNumber}
            onChangeText={setLicenceNumber}
            placeholder="e.g. RND-987654"
            autoCapitalize="none"
            autoComplete="off"
          />

          {/* Document Uploads Section */}
          <View style={styles.uploadSection}>
            <Text style={styles.uploadSectionTitle}>Upload Rider Verification Documents</Text>

            {/* Passport Photo Upload */}
            <View style={styles.uploadRow}>
              <View style={styles.uploadInfo}>
                <Text style={styles.uploadLabel}>Passport Photo</Text>
                <Text style={styles.uploadSub}>Headshot photo for rider identification</Text>
              </View>
              {passportPhoto ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: passportPhoto }} style={styles.previewImage} />
                  <Pressable onPress={() => setPassportPhoto(null)} style={styles.removeBadge}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <SecondaryButton
                  label="📷 Choose"
                  onPress={() => { void pickImage(setPassportPhoto); }}
                />
              )}
            </View>

            {/* National ID Photo Upload */}
            <View style={styles.uploadRow}>
              <View style={styles.uploadInfo}>
                <Text style={styles.uploadLabel}>National ID Card</Text>
                <Text style={styles.uploadSub}>Front photo of your National ID or Passport</Text>
              </View>
              {identityCardPhoto ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: identityCardPhoto }} style={styles.previewImage} />
                  <Pressable onPress={() => setIdentityCardPhoto(null)} style={styles.removeBadge}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <SecondaryButton
                  label="📷 Choose"
                  onPress={() => { void pickImage(setIdentityCardPhoto); }}
                />
              )}
            </View>

            {/* Driver's License Photo Upload */}
            <View style={styles.uploadRow}>
              <View style={styles.uploadInfo}>
                <Text style={styles.uploadLabel}>Driver's License</Text>
                <Text style={styles.uploadSub}>Photo of your active motorcycle driving license</Text>
              </View>
              {licencePhoto ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: licencePhoto }} style={styles.previewImage} />
                  <Pressable onPress={() => setLicencePhoto(null)} style={styles.removeBadge}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <SecondaryButton
                  label="📷 Choose"
                  onPress={() => { void pickImage(setLicencePhoto); }}
                />
              )}
            </View>
          </View>

          {/* Password */}
          <InputField
            label="Password *"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            placeholder="Minimum 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />

          {/* Confirm Password */}
          <InputField
            label="Confirm password *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={confirmPasswordError}
            placeholder="Re-enter password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />

          <PrimaryButton
            label={isSubmitting ? 'Creating rider account...' : 'Create rider account'}
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
  uploadSection: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  uploadSectionTitle: {
    fontSize: theme.typography.body,
    fontWeight: '800',
    color: theme.colors.text,
  },
  uploadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  uploadInfo: {
    flex: 1,
    gap: 2,
  },
  uploadLabel: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  uploadSub: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  previewWrap: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: theme.radius.input,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
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
});
