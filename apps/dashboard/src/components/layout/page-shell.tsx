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
    <section className="space-y-5">
      <header className="rounded-[var(--radius-panel)] border border-line bg-surface px-6 py-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              Command surface
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.85rem,1.55rem+1vw,2.5rem)] font-semibold text-ink">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{description}</p>
          </div>

          <div className="rounded-[18px] bg-surface-muted px-4 py-3 text-sm text-ink-soft">
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
