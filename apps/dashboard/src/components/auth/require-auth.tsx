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

  // Synchronously compute if path is forbidden for current user
  const isForbidden = useMemo(() => {
    if (!data || pathname === '/forbidden') return false;

    // Check HQ route permission
    if (pathname?.startsWith('/hq')) {
      return data.fleetName !== 'E-Moto HQ';
    }

    // Check Insurer role permissions
    if (data.role === 'INSURER') {
      const isAllowed =
        pathname === '/' ||
        pathname === '/overview' || pathname.startsWith('/overview/') ||
        pathname.startsWith('/bikes') ||
        pathname.startsWith('/events') ||
        pathname.startsWith('/incidents') ||
        pathname.startsWith('/trips') ||
        pathname.startsWith('/reports') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/insurer');

      return !isAllowed;
    }

    // Non-insurers attempting /insurer routes
    if (pathname?.startsWith('/insurer')) {
      return true;
    }

    return false;
  }, [data, pathname]);

  useEffect(() => {
    if (isLoading) return;

    if (isError) {
      clearAuthToken();
      router.replace(`/login?expired=true&next=${encodeURIComponent(nextPath)}`);
      return;
    }

    if (!data) return;

    if (data.role === 'RIDER') {
      clearAuthToken();
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
      router.replace('/login?error=rider');
      return;
    }

    if (data.status === 'PENDING_SETUP') {
      clearAuthToken();
      const successUrl = data.role === 'INSURER'
        ? '/registration-success?type=insurance'
        : '/registration-success';
      router.replace(successUrl);
      return;
    }

    if (isForbidden) {
      router.replace('/forbidden');
      return;
    }
  }, [isLoading, isError, data, isForbidden, nextPath, pathname, router]);

  const isPendingSetup = data?.status === 'PENDING_SETUP';
  const isInvalidRole = data?.role === 'RIDER';

  if (!hasWindow || (isLoading && !isError) || isError || isPendingSetup || isInvalidRole || isForbidden) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="text-sm font-medium text-zinc-400">
            {isPendingSetup ? 'Redirecting to setup status...' : isForbidden ? 'Redirecting...' : 'Checking session...'}
          </p>
          {isTimedOut && (
            <button 
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-cyan-400 underline underline-offset-4"
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

