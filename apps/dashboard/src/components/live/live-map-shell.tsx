'use client';

import dynamic from 'next/dynamic';

const LiveMapPanel = dynamic(
  () => import('@/components/live/live-map').then((module) => module.LiveMapPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-[80vh] min-h-[640px] rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
        Loading live map...
      </div>
    ),
  },
);

export function LiveMapShell() {
  return <LiveMapPanel />;
}

