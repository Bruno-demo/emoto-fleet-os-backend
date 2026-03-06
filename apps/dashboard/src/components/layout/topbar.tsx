'use client';

import { useCurrentUser } from '@/lib/auth/use-current-user';

export function Topbar() {
  const { data: user } = useCurrentUser();

  const fleetLabel =
    user?.fleetName?.trim() || (user?.fleetId ? `Fleet ${user.fleetId.slice(0, 8)}` : 'Fleet');

  return (
    <header className="flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Operations</p>
        <h1 className="font-display text-xl font-semibold text-ink">{fleetLabel}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
          {user?.role ?? '...'}
        </span>
        <span className="hidden text-sm text-ink-soft md:inline">
          {user?.email ?? user?.phone ?? 'authenticated user'}
        </span>
      </div>
    </header>
  );
}
