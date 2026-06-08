'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { meResponseSchema } from '@/lib/api/schemas';
import type { SessionUser } from '@/lib/types/dashboard';

export function useCurrentUser() {
  const hasWindow = typeof window !== 'undefined';

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<SessionUser>('/me', {}, { schema: meResponseSchema, auth: false }),
    enabled: hasWindow,
    retry: false,
  });
}
