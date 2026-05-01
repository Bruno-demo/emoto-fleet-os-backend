'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
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
        <p className="text-sm text-ink-soft">Checking session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
