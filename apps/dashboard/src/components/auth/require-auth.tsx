'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api/client';
import { meResponseSchema } from '@/lib/api/schemas';
import { clearAuthToken } from '@/lib/auth/session';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasWindow = typeof window !== 'undefined';

  const nextPath = useMemo(() => {
    return pathname?.startsWith('/') ? pathname : '/';
  }, [pathname]);

  const { isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/me', {}, { schema: meResponseSchema }),
    enabled: hasWindow,
    retry: false,
  });

  // Redirects unauthenticated users to login while preserving intended destination.
  const redirectToLogin = useCallback(() => {
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [nextPath, router]);

  useEffect(() => {
    if (!isError) {
      return;
    }
    clearAuthToken();
    redirectToLogin();
  }, [isError, redirectToLogin]);

  if (!hasWindow || isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="text-sm text-ink-soft">Checking session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
