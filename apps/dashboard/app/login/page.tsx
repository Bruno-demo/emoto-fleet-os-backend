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
import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import {
  buildLoginPayload,
  loginFormSchema,
  loginResponseSchema,
} from '@/lib/api/schemas';
import { readAuthToken, writeAuthToken } from '@/lib/auth/session';
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
  const [touched, setTouched] = useState({ identifier: false, password: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginPresentation = getLoginPresentation();

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

  useEffect(() => {
    if (readAuthToken()) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  // Validates credentials then requests a JWT from the Nest auth endpoint.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setTouched({ identifier: true, password: true });

    const parsed = loginFormSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid login form values');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = buildLoginPayload(parsed.data.identifier, parsed.data.password);
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

      writeAuthToken(response.accessToken, { persist: rememberMe });
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
              className="text-xs font-semibold text-[#0F172A]/60 transition hover:text-[#0F172A]"
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
            className="text-xs font-semibold text-[#0F172A]/60 transition hover:text-[#0F172A]"
          >
            Forgot password?
          </Link>
        </div>

        {error ? <AuthNotice message={error} tone="error" /> : null}

        <AuthButton
          type="submit"
          label={isSubmitting ? 'Signing in...' : 'Login'}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        />

        <div className="flex items-center gap-3 text-xs text-[#0F172A]/40">
          <span className="h-px flex-1 bg-[#0F172A]/10" />
          <span>Or continue with</span>
          <span className="h-px flex-1 bg-[#0F172A]/10" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthButton
            type="button"
            variant="secondary"
            label="Google"
            icon={<span className="text-base font-semibold">G</span>}
          />
          <AuthButton
            type="button"
            variant="secondary"
            label="Apple"
            icon={<span className="text-base font-semibold">A</span>}
          />
        </div>

        <p className="text-center text-xs text-[#0F172A]/60">
          New to Fleet OS?{' '}
          <Link href="/create-account" className="font-semibold text-[#0F172A]">
            Create an account
          </Link>
        </p>
      </form>

      {loginPresentation.showDemoCredentials ? (
        <div className="mt-6 rounded-[20px] border border-[#0F172A]/10 bg-white/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0F172A]/50">
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
        <div className="mt-6 rounded-[20px] border border-[#0F172A]/10 bg-white/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0F172A]/50">
            Access help
          </p>
          <p className="mt-2 text-xs leading-5 text-[#0F172A]/60">
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
    <div className="rounded-[16px] border border-[#0F172A]/10 bg-white px-3 py-3">
      <p className="text-xs font-semibold text-[#0F172A]">{label}</p>
      <p className="mt-2 text-xs leading-5 text-[#0F172A]/60">{identifier}</p>
      <p className="text-xs leading-5 text-[#0F172A]/60">{password}</p>
    </div>
  );
}
