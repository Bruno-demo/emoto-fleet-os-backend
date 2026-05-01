'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { clearAuthToken } from '@/lib/auth/session';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasWindow = typeof window !== 'undefined';

  const nextPath = useMemo(() => {
    return pathname?.startsWith('/') ? pathname : '/';
  }, [pathname]);

  const { data, isLoading, isError } = useCurrentUser();

  // Real timeout state
  const [isTimedOut, setIsTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setIsTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (isLoading) setIsTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Redirects unauthenticated users to login while preserving intended destination.
  const redirectToLogin = useCallback(() => {
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [nextPath, router]);

  useEffect(() => {
    if (data?.status === 'PENDING_SETUP') {
      clearAuthToken();
      router.replace('/registration-success');
      return;
    }

    if (isError) {
      clearAuthToken();
      router.replace(`/login?expired=true&next=${encodeURIComponent(nextPath)}`);
    }
  }, [isError, data?.status, nextPath, router]);

  if (!hasWindow || (isLoading && !isError)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-ink-soft">Checking session...</p>
          {isTimedOut && (
            <button 
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-accent underline underline-offset-4"
            >
              Taking too long? Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
