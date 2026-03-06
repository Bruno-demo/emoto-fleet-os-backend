'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { meResponseSchema } from '@/lib/api/schemas';
import { readAuthToken } from '@/lib/auth/session';
import type { SessionUser } from '@/lib/types/dashboard';

export function useCurrentUser() {
  const hasWindow = typeof window !== 'undefined';
  const token = hasWindow ? readAuthToken() : null;

  return useQuery<SessionUser>({
    queryKey: ['auth', 'me', token],
    queryFn: () => apiFetch('/me', {}, { schema: meResponseSchema }),
    enabled: hasWindow && !!token,
    retry: false,
  });
}
