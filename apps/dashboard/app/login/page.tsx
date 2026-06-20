'use client';

import {
  Activity,
  ArrowLeft,
  AtSign,
  Eye,
  EyeOff,
  Lock,
  Navigation2,
  ShieldCheck,
  UserPlus,
  Building2,
  Banknote,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import {
  buildLoginPayload,
  loginFormSchema,
  loginResponseSchema,
} from '@/lib/api/schemas';
import {
  AuthButton,
  AuthCheckbox,
  AuthInput,
  AuthNotice,
  AuthPanelHeader,
  AuthShell,
  AuthTabs,
} from '@/components/auth/auth-ui';
import { useTranslation } from '@/components/i18n/LanguageProvider';


type LoginFieldErrors = {
  identifier?: string;
  password?: string;
};

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState({ identifier: false, password: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isRiderBlocked, setIsRiderBlocked] = useState(false);
  const loginPresentation = getLoginPresentation();

  // OTP login flow state
  const [requireOtp, setRequireOtp] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setIsExpired(true);
    }
    if (params.get('error') === 'rider') {
      setIsRiderBlocked(true);
    }
  }, []);

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return '/overview';
    }
    const requestedPath = new URLSearchParams(window.location.search).get('next');
    if (!requestedPath || !requestedPath.startsWith('/')) {
      return '/overview';
    }
    return requestedPath;
  }, []);

  const fieldErrors = useMemo<LoginFieldErrors>(() => {
    const errors: LoginFieldErrors = {};
    const trimmed = identifier.trim();

    if (touched.identifier) {
      if (trimmed.length === 0) {
        errors.identifier = t('credentials_error');
      } else if (!trimmed.includes('@')) {
        if (!/^07\d{8}$/.test(trimmed)) {
          errors.identifier = t('phone_error');
        }
      } else if (trimmed.length < 3) {
        errors.identifier = t('credentials_error');
      }
    }
    if (touched.password && password.length < 8) {
      errors.password = t('password_error');
    }
    return errors;
  }, [identifier, password, touched.identifier, touched.password, t]);

  // Validates credentials then requests a JWT or OTP prompt from the Nest auth endpoint.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSocialNotice(null);
    setTouched({ identifier: true, password: true });

    const parsed = loginFormSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid login form values');
      return;
    }

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier.includes('@') && trimmedIdentifier.length > 0 && !/^07\d{8}$/.test(trimmedIdentifier)) {
      setError(t('phone_error'));
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = buildLoginPayload(
        parsed.data.identifier,
        parsed.data.password,
        rememberMe,
      );
      const response = await apiFetch(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        {
          auth: false,
          schema: loginResponseSchema,
        },
      );

      if ('requireOtp' in response && response.requireOtp) {
        setRequireOtp(true);
        setTempToken(response.tempToken);
        setUserEmail(response.email);
        if (response.otp) {
          setDevOtp(response.otp);
        }
        return;
      }

      if ('user' in response && response.user.role === 'RIDER') {
        await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
        setError('You are a rider. Please access through the mobile app.');
        return;
      }

      if ('user' in response && response.user.status === 'PENDING_SETUP') {
        await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
        const isInsurer = 'user' in response && response.user.role === 'INSURER';
        setError(
          isInsurer
            ? 'Your subscription payment is still pending. Our team will contact you shortly.'
            : 'Your hardware installation is still pending.'
        );
        return;
      }

      if ('accessToken' in response) {
        router.replace(nextPath);
      }
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError('Unable to login right now');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submits the OTP code to complete authentication.
  const handleVerifyOtpAndLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOtpError(null);
    
    if (otpCode.length !== 6) {
      setOtpError('Please enter a 6-digit OTP code');
      return;
    }
    if (!tempToken) {
      setOtpError('Invalid session. Please login again.');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const response = await apiFetch<{
        accessToken: string;
        tokenType: 'Bearer';
        user: { status: string; role: string; email: string; id: string };
      }>('/auth/login-otp', {
        method: 'POST',
        body: JSON.stringify({
          tempToken,
          otp: otpCode.trim(),
        }),
      }, { auth: false });

      if (response.user.role === 'RIDER') {
        await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
        setOtpError('You are a rider. Please access through the mobile app.');
        return;
      }

      if (response.user.status === 'PENDING_SETUP') {
        await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
        const isInsurer = response.user.role === 'INSURER';
        setOtpError(
          isInsurer
            ? 'Your subscription payment is still pending. Our team will contact you shortly.'
            : 'Your hardware installation is still pending.'
        );
        return;
      }

      router.replace(nextPath);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setOtpError(err.message);
      } else {
        setOtpError('Invalid or expired OTP code');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resends the login OTP code to user's verified email.
  const resendLoginOtp = async () => {
    if (!userEmail) return;
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await apiFetch<{ otp?: string }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail, reason: 'login' }),
      }, { auth: false });
      
      if (res.otp) {
        setDevOtp(res.otp);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setOtpError(err.message);
      } else {
        setOtpError('Failed to resend OTP code');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t('secure_access')}
      title={t('trusted_access')}
      subtitle={t('login_center_desc')}
      securityHint={t('data_secure')}
      features={[
        {
          icon: <UserPlus size={16} />,
          title: t('guided_onboarding'),
          description: t('guided_onboarding_desc'),
        },
        {
          icon: <Navigation2 size={16} />,
          title: t('realtime_telemetry'),
          description: t('realtime_telemetry_desc'),
        },
        {
          icon: <Activity size={16} />,
          title: t('incident_response'),
          description: t('incident_response_desc'),
        },
        {
          icon: <ShieldCheck size={16} />,
          title: t('policy_controls'),
          description: t('policy_controls_desc'),
        },
        {
          icon: <Building2 size={16} />,
          title: t('scales_growth'),
          description: t('scales_growth_desc'),
        },
        {
          icon: <Banknote size={16} />,
          title: t('automated_billing'),
          description: t('automated_billing_desc'),
        },
      ]}
    >
      <AuthPanelHeader
        eyebrow={t('welcome_back')}
        title={t('login_title')}
        description={t('login_desc')}
      />
      <AuthTabs active="login" />

      {requireOtp ? (
        <form className="mt-6 space-y-4" onSubmit={handleVerifyOtpAndLogin}>
          <div className="rounded-[20px] border border-accent/20 bg-accent/[0.03] p-5 space-y-4 transition-all animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-accent" /> Email Verification
              </p>
              {devOtp && (
                <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20">
                  Dev Mode OTP: {devOtp}
                </span>
              )}
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              A 6-digit verification code has been sent to the email address <span className="font-semibold text-ink">{userEmail}</span> to complete your login.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-center font-mono text-lg tracking-[0.4em] text-ink placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-soft placeholder:text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                disabled={isVerifyingOtp}
                autoFocus
              />
            </div>

            {otpError && (
              <AuthNotice message={otpError} tone="error" />
            )}

            <div className="flex justify-between items-center text-xs text-ink-muted">
              <span>Didn&apos;t receive the code?</span>
              <button
                type="button"
                onClick={resendLoginOtp}
                className="font-semibold text-accent hover:underline focus:outline-none"
                disabled={isSendingOtp}
              >
                {isSendingOtp ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>

          <AuthButton
            type="submit"
            label={isVerifyingOtp ? 'Verifying...' : 'Verify & Login'}
            isLoading={isVerifyingOtp}
            disabled={otpCode.length !== 6 || isVerifyingOtp}
          />

          <button
            type="button"
            onClick={() => {
              setRequireOtp(false);
              setTempToken(null);
              setOtpCode('');
              setOtpError(null);
              setDevOtp(null);
            }}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-ink py-2"
          >
            <ArrowLeft size={14} /> Back to credentials
          </button>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <AuthInput
            label={t('email_or_phone')}
            placeholder={loginPresentation.identifierPlaceholder}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, identifier: true }))}
            autoComplete="username"
            icon={<AtSign size={16} />}
            error={fieldErrors.identifier}
            helper={t('access_help_desc')}
          />
          <AuthInput
            label={t('password')}
            placeholder={t('password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            autoComplete="current-password"
            icon={<Lock size={16} />}
            error={fieldErrors.password}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-xs font-semibold text-ink-muted transition hover:text-ink"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <AuthCheckbox
              checked={rememberMe}
              onChange={setRememberMe}
              label={t('remember_me')}
              disabled={isSubmitting}
            />
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-ink-muted transition hover:text-ink"
            >
              {t('forgot_password')}
            </Link>
          </div>

          {isExpired ? (
            <AuthNotice
              message="Your session has expired. Please log in again to continue."
              tone="warning"
            />
          ) : null}
          {isRiderBlocked ? (
            <AuthNotice
              message="You are a rider. Please access through the mobile app."
              tone="error"
            />
          ) : null}
          {error ? <AuthNotice message={error} tone="error" /> : null}
          {socialNotice ? <AuthNotice message={socialNotice} tone="warning" /> : null}

          <AuthButton
            type="submit"
            label={isSubmitting ? t('signing_in') : t('signin')}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />

          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="h-px flex-1 bg-line" />
            <span>{t('or_continue_with')}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AuthButton
              type="button"
              variant="secondary"
              label="Google"
              icon={<span className="text-base font-semibold">G</span>}
              onClick={() => handleSocialLogin('google', setSocialNotice)}
            />
            <AuthButton
              type="button"
              variant="secondary"
              label="Apple"
              icon={<span className="text-base font-semibold">A</span>}
              onClick={() => handleSocialLogin('apple', setSocialNotice)}
            />
          </div>

          <p className="text-center text-xs text-ink-muted">
            {t('new_to_fleet_os')}{' '}
            <Link href="/create-account" className="font-semibold text-ink">
              {t('create_account_link')}
            </Link>
          </p>
        </form>
      )}

      {loginPresentation.showDemoCredentials ? (
        <div className="mt-6 rounded-[20px] border border-line bg-surface-muted p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Demo credentials
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CredentialHint
              label="Demo Fleet"
              identifier="admin@demo.emoto"
              password="ChangeMe123!"
            />
            <CredentialHint
              label="North Ops Fleet"
              identifier="admin@north.demo.emoto"
              password="FleetTwo123!"
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[20px] border border-line bg-surface-muted p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            {t('access_help')}
          </p>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            {t('access_help_desc')}
          </p>
        </div>
      )}
    </AuthShell>
  );
}

// Chooses development-only helper copy without exposing seeded credentials in production-facing builds.
function getLoginPresentation() {
  const showDemoCredentials =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1';

  if (showDemoCredentials) {
    return {
      showDemoCredentials: true,
      description:
        'Use a fleet operator email or phone account. Seeded examples are shown below for local development.',
      identifierPlaceholder: 'admin@demo.emoto or 0700000101',
    };
  }

  return {
    showDemoCredentials: false,
    description: 'Use the email address or phone number assigned to your fleet operator account.',
    identifierPlaceholder: 'name@fleet.example or 07...',
  };
}

// Routes the user to the configured OAuth endpoint or displays a warning if unavailable.
function handleSocialLogin(
  provider: 'google' | 'apple',
  setNotice: (message: string | null) => void,
) {
  const oauthUrl =
    provider === 'google'
      ? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_URL
      : process.env.NEXT_PUBLIC_APPLE_OAUTH_URL;

  if (!oauthUrl) {
    setNotice('Social login is not configured for this environment yet.');
    return;
  }

  window.location.href = oauthUrl;
}

// Renders compact demo account hints when the login screen is running in development mode.
function CredentialHint({
  label,
  identifier,
  password,
}: {
  label: string;
  identifier: string;
  password: string;
}) {
  return (
    <div className="rounded-[16px] border border-line bg-surface px-3 py-3">
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="mt-2 text-xs leading-5 text-ink-muted">{identifier}</p>
      <p className="text-xs leading-5 text-ink-muted">{password}</p>
    </div>
  );
}

