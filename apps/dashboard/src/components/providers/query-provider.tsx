'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            // Keep cached data for 10 minutes so pages don't go blank during
            // connectivity dips. Default is 5 min which is too short on flaky
            // networks where the user might lose signal and come back.
            gcTime: 10 * 60 * 1000,
            // Retry up to 3 times with exponential backoff (1s, 2s, 4s).
            // This is critical on low-bandwidth connections where the first
            // attempt often times out but a retry succeeds.
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
            refetchOnWindowFocus: false,
            // Allow queries to return cached data even when offline, instead
            // of immediately erroring. The query will refetch once online.
            networkMode: 'offlineFirst',
          },
          mutations: {
            // Mutations get 2 retries — important for payment recordings and
            // command dispatches that fail on flaky connections.
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 6000),
            networkMode: 'offlineFirst',
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
