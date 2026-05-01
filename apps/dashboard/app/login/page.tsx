'use client';

import {
  Activity,
  AtSign,
  Eye,
  EyeOff,
  Lock,
  Navigation2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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


type LoginFieldErrors = {
  identifier?: string;
  password?: string;
};

export default function LoginPage() {
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
  const loginPresentation = getLoginPresentation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setIsExpired(true);
    }
  }, []);

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return '/';
    }
    const requestedPath = new URLSearchParams(window.location.search).get('next');
    if (!requestedPath || !requestedPath.startsWith('/')) {
      return '/';
    }
    return requestedPath;
  }, []);

  const fieldErrors = useMemo<LoginFieldErrors>(() => {
    const errors: LoginFieldErrors = {};

    if (touched.identifier && identifier.trim().length < 3) {
      errors.identifier = 'Provide email or phone';
    }
    if (touched.password && password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    return errors;
  }, [identifier, password, touched.identifier, touched.password]);

  // Validates credentials then requests a JWT from the Nest auth endpoint.
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

      if (response.user.status === 'PENDING_SETUP') {
        await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
        setError('Your hardware installation is still pending.');
        return;
      }

      router.replace(nextPath);
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

  return (
    <AuthShell
      eyebrow="Secure Access"
      title="Trusted access for live fleet operations."
      subtitle="Log in to the Fleet OS command center to monitor riders, resolve incidents, and coordinate safer journeys in real time."
      securityHint="Your data is सुरक्षित / secure"
      features={[
        {
          icon: <Navigation2 size={16} />,
          title: 'Realtime telemetry',
          description: 'Track speed, battery, and trip activity with live fleet visibility.',
        },
        {
          icon: <Activity size={16} />,
          title: 'Incident response',
          description: 'Handle crashes and SOS alerts with guided workflows.',
        },
        {
          icon: <ShieldCheck size={16} />,
          title: 'Policy controls',
          description: 'Role-based access, audit trails, and command safety checks.',
        },
      ]}
    >
      <AuthPanelHeader
        eyebrow="Welcome back"
        title="Login to Fleet OS"
        description="Use your fleet email or phone number to continue. Login stays secure even on low-bandwidth networks."
      />
      <AuthTabs active="login" />

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <AuthInput
          label="Email or phone"
          placeholder={loginPresentation.identifierPlaceholder}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, identifier: true }))}
          autoComplete="username"
          icon={<AtSign size={16} />}
          error={fieldErrors.identifier}
          helper="Use the phone or email issued by your fleet admin."
        />
        <AuthInput
          label="Password"
          placeholder="Enter your password"
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
            label="Remember me for 30 days"
            disabled={isSubmitting}
          />
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-ink-muted transition hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>

        {isExpired ? (
          <AuthNotice
            message="Your session has expired. Please log in again to continue."
            tone="warning"
          />
        ) : null}
        {error ? <AuthNotice message={error} tone="error" /> : null}
        {socialNotice ? <AuthNotice message={socialNotice} tone="warning" /> : null}

        <AuthButton
          type="submit"
          label={isSubmitting ? 'Signing in...' : 'Login'}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        />

        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-line" />
          <span>Or continue with</span>
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
          New to Fleet OS?{' '}
          <Link href="/create-account" className="font-semibold text-ink">
            Create an account
          </Link>
        </p>
      </form>

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
            Access help
          </p>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Use the credentials issued by your fleet administrator. If you need access, request an invite
            or contact your operations lead.
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
      identifierPlaceholder: 'admin@demo.emoto or +250700000101',
    };
  }

  return {
    showDemoCredentials: false,
    description: 'Use the email address or phone number assigned to your fleet operator account.',
    identifierPlaceholder: 'name@fleet.example or +2507...',
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
