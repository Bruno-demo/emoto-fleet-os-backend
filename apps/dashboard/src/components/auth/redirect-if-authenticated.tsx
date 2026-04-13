'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/auth/use-current-user';

// Redirects already-authenticated users away from login and signup pages.
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      router.replace('/live');
    }
  }, [user, router]);

  // Render children on the server and before mount to avoid hydration mismatch.
  // The auth query is disabled server-side (enabled: hasWindow), so isLoading
  // only becomes true after hydration when the query starts.
  if (!mounted) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)]/40 border-t-[var(--accent)]" />
          <p className="text-sm text-ink-soft">Checking session...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}
