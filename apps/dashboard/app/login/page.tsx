'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api/client';
import {
  buildLoginPayload,
  loginFormSchema,
  loginResponseSchema,
} from '@/lib/api/schemas';
import { readAuthToken, writeAuthToken } from '@/lib/auth/session';

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
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, {
        auth: false,
        schema: loginResponseSchema,
      });

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
    <div className="grid min-h-screen place-items-center px-6 py-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-accent">
          eMoto Fleet OS
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink">
          Dashboard Login
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Use email/password or phone/password from the API user accounts.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-ink">
            Email or phone
            <input
              className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 outline-none transition focus:border-accent"
              placeholder="admin@demo.emoto or +250700000001"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Password
            <input
              className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 outline-none transition focus:border-accent"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
