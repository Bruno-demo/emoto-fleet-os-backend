'use client';

import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-error/10 text-error">
        <ShieldAlert size={40} />
      </div>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Access Restricted
      </h1>

      <p className="mt-4 max-w-md text-base leading-7 text-ink-muted">
        You don't have the required permissions to access the HQ command center. 
        This area is reserved for super-administrators only.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/live"
          className="inline-flex items-center gap-2 rounded-[16px] bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong active:scale-95"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
        
        <Link
          href="/login"
          className="text-sm font-semibold text-ink-muted transition hover:text-ink"
        >
          Sign in with another account
        </Link>
      </div>
      
      <p className="mt-12 text-xs text-ink-soft">
        Error Code: 403 Forbidden
      </p>
    </div>
  );
}
