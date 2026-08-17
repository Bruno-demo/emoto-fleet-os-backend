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

  if (isLoading || user?.fleetName !== 'E-Moto HQ') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#09090b]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

