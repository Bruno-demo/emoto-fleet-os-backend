'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCurrentUser } from '@/lib/auth/use-current-user';

/**
 * Guard component that restricts access to the HQ dashboard.
 * Only users belonging to the 'E-Moto HQ' fleet are allowed to proceed.
 */
export function HqGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading || !user) return;

    // Check if the user is a super admin (belongs to the HQ fleet).
    const isSuperAdmin = user.fleetName === 'E-Moto HQ';

    if (!isSuperAdmin) {
      // Redirect to forbidden page if they aren't authorized for HQ.
      router.replace('/forbidden');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface">
        <p className="text-sm font-medium text-ink-soft animate-pulse">
          Verifying HQ access...
        </p>
      </div>
    );
  }

  // Only render children if verified as super admin.
  if (user?.fleetName === 'E-Moto HQ') {
    return <>{children}</>;
  }

  // Otherwise return nothing (redirecting...)
  return null;
}

