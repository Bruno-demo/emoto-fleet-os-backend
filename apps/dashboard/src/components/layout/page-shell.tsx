'use client';

import type { ReactNode } from 'react';
import { useRealtime } from '@/components/realtime/realtime-provider';

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { connectionState } = useRealtime();
  const statusCopy = getPageShellStatus(connectionState);

  return (
    <section className="space-y-4">
      <header className="relative overflow-hidden rounded-[32px] border border-white/5 bg-black/20 p-8 shadow-2xl glass-panel group">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100 mix-blend-screen pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              Command surface
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.7rem,1.45rem+1vw,2.25rem)] font-semibold text-ink">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-ink-soft">{description}</p>
          </div>

          <div className="glass-panel rounded-[20px] bg-white/5 border border-white/10 px-5 py-3 text-sm text-white/70 max-w-sm backdrop-blur-md shadow-inner">
            {statusCopy}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}

// Keeps shared page-shell guidance aligned with live websocket health instead of static copy.
function getPageShellStatus(
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'offline',
) {
  if (connectionState === 'connected') {
    return 'Live telemetry is flowing. Page data will keep updating as websocket events arrive.';
  }
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return 'Realtime transport is reconnecting. Cached data stays visible while the live stream recovers.';
  }
  return 'Realtime transport is offline. Use the available API data and refresh after connectivity returns.';
}
