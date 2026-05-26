'use client';

import { MapPinOff, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-brand/10 text-brand">
        <MapPinOff size={40} />
      </div>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Page Not Found
      </h1>

      <p className="mt-4 max-w-md text-base leading-7 text-ink-muted">
        The coordinate you are looking for doesn&apos;t exist in our telemetry. 
        It might have been moved or the path was entered incorrectly.
      </p>

      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-[16px] bg-ink px-6 py-3 text-sm font-semibold text-surface transition hover:bg-ink/90 active:scale-95"
        >
          <Home size={16} />
          Return Home
        </Link>
      </div>
      
      <p className="mt-12 text-xs text-ink-soft">
        Error Code: 404 Not Found
      </p>
    </div>
  );
}

