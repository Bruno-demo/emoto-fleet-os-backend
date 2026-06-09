'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { clearAuthToken } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';

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
      const timer = setTimeout(() => {
        setIsTimedOut(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      if (isLoading) setIsTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (data?.role === 'RIDER') {
      clearAuthToken();
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
      router.replace('/login?error=rider');
      return;
    }

    if (data?.status === 'PENDING_SETUP') {
      clearAuthToken();
      const successUrl = data?.role === 'INSURER'
        ? '/registration-success?type=insurance'
        : '/registration-success';
      router.replace(successUrl);
      return;
    }

    if (data?.role === 'INSURER') {
      const isOverview = pathname === '/' || pathname === '/overview' || pathname.startsWith('/overview/');
      const isAllowed = pathname.startsWith('/bikes') || pathname.startsWith('/reports') || pathname === '/forbidden';

      if (isOverview) {
        router.replace('/bikes');
        return;
      }

      if (!isAllowed) {
        router.replace('/forbidden');
        return;
      }
    }

    if (isError) {
      clearAuthToken();
      router.replace(`/login?expired=true&next=${encodeURIComponent(nextPath)}`);
    }
  }, [isError, data?.status, data?.role, nextPath, pathname, router]);

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

