'use client';

import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

// Root-level error boundary for unhandled render and async errors.
// Next.js automatically wraps route segments in React Error Boundaries.
// This file catches errors in all routes that don't have their own error.tsx.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-red-500/10 text-red-500 animate-pulse">
        <AlertTriangle size={40} />
      </div>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Something went wrong
      </h1>

      <p className="mt-4 max-w-md text-base leading-7 text-ink-muted">
        An unexpected error occurred while loading this page. This is usually
        caused by a network interruption or a temporary server issue.
      </p>

      {error.message && (
        <p className="mt-3 max-w-md rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-xs font-mono text-ink-soft">
          {error.message}
        </p>
      )}

      <div className="mt-10 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-[16px] px-6 py-3 text-sm font-semibold transition active:scale-95 hover:bg-accent-strong shadow-sm"
          style={{ background: '#3B82F6', color: 'white' }}
        >
          <RefreshCw size={16} />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-[16px] border border-line bg-surface-hover px-6 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted active:scale-95"
        >
          <Home size={16} />
          Return Home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-12 text-xs text-ink-soft">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
