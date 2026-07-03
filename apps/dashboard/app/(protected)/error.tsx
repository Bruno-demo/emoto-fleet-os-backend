'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

// Error boundary specifically for protected (authenticated) dashboard routes.
// Catches render errors inside the AppShell without destroying the whole page shell.
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNetworkError =
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('Network') ||
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('timed out') ||
    error.message?.includes('AbortError') ||
    error.message?.includes('ECONNREFUSED');

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-[20px] ${
          isNetworkError
            ? 'bg-warning-soft text-warning-ink animate-pulse'
            : 'bg-red-500/10 text-red-500'
        }`}
      >
        <WifiOff size={32} />
      </div>

      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink">
        {isNetworkError ? 'Connection lost' : 'Page failed to load'}
      </h2>

      <p className="mt-3 max-w-sm text-sm leading-6 text-ink-muted">
        {isNetworkError
          ? 'Your internet connection appears to be unstable. The dashboard will recover automatically when your connection is restored.'
          : 'An unexpected error occurred while rendering this page. Try refreshing — if the problem persists, contact support.'}
      </p>

      {error.message && (
        <p className="mt-3 max-w-sm rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-xs font-mono text-ink-soft break-all">
          {error.message.length > 200
            ? error.message.slice(0, 200) + '…'
            : error.message}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-[16px] px-5 py-2.5 text-sm font-semibold transition active:scale-95 hover:brightness-110 shadow-sm"
          style={{ background: '#3B82F6', color: 'white' }}
        >
          <RefreshCw size={15} />
          Retry
        </button>
        <Link
          href="/overview"
          className="inline-flex items-center gap-2 rounded-[16px] border border-line bg-surface-hover px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-muted active:scale-95"
        >
          <Home size={15} />
          Overview
        </Link>
      </div>

      {error.digest && (
        <p className="mt-10 text-[11px] text-ink-soft">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
