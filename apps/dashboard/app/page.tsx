'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LandingContent from './landing-content';
import { readAuthToken } from '@/lib/auth/session';

// Maps the dashboard root route to the public landing experience.
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = readAuthToken();
    if (token) {
      router.replace('/live');
    }
  }, [router]);

  return <LandingContent />;
}
