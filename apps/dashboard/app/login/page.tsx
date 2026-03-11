'use client';

import { Activity, LockKeyhole, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildLoginPayload,
  loginFormSchema,
  loginResponseSchema,
} from '@/lib/api/schemas';
import { readAuthToken, writeAuthToken } from '@/lib/auth/session';
import { ApiError, apiFetch } from '@/lib/api/client';
import { InlineNotice, TextField } from '@/components/ui/form-controls';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    if (readAuthToken()) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  // Validates credentials then requests a JWT from the Nest auth endpoint.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

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

      writeAuthToken(response.accessToken);
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(5,150,105,0.12),transparent_28%),var(--background)] px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-line bg-surface p-8 shadow-[var(--shadow-strong)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            E-Moto Safety & Fleet OS
          </p>
          <h1 className="mt-4 max-w-xl font-display text-[clamp(2.5rem,2rem+1.5vw,4rem)] font-semibold leading-tight text-ink">
            Dispatch-grade fleet visibility starts with a clean operator login.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
            Command center access gives dispatch, operations, and safety teams the same live map,
            incident workflow, and command surfaces used during daily fleet response.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <FeatureTile
              icon={<Activity size={18} />}
              title="Realtime command center"
              description="Live bike telemetry, command acknowledgements, and grouped alerts."
            />
            <FeatureTile
              icon={<ShieldAlert size={18} />}
              title="Incident triage"
              description="Crash, SOS, and theft workflows with evidence-pack exports."
            />
            <FeatureTile
              icon={<LockKeyhole size={18} />}
              title="Role-aware access"
              description="Fleet-scoped routes, command gating, and protected evidence access."
            />
          </div>
        </section>

        <section className="rounded-[32px] border border-line bg-surface p-8 shadow-[var(--shadow-strong)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            Secure sign-in
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Dashboard login</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Use an email or phone-based fleet account from the seeded API users.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <TextField
              label="Email or phone"
              placeholder="admin@demo.emoto or +250700000101"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
            />
            <TextField
              label="Password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />

            {error ? <InlineNotice message={error} /> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-[var(--radius-control)] bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in to dashboard'}
            </button>
          </form>

          <div className="mt-6 rounded-[24px] border border-line bg-surface-muted px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Seeded operator examples
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
        </section>
      </div>
    </div>
  );
}

function FeatureTile({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[24px] border border-line bg-surface-muted px-5 py-5">
      <span className="inline-flex rounded-[18px] bg-white p-3 text-accent">{icon}</span>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
    </article>
  );
}

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
    <div className="rounded-[18px] border border-line bg-white px-4 py-3">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="mt-2 text-xs leading-5 text-ink-soft">{identifier}</p>
      <p className="text-xs leading-5 text-ink-soft">{password}</p>
    </div>
  );
}
