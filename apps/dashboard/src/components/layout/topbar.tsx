'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, Menu, Search, Siren, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionIndicator } from '@/components/ui/connection-indicator';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { Incident, PaginatedResponse } from '@/lib/types/dashboard';
import { cx, formatTimeAgo } from '@/lib/ui';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'topbar-open'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=10'),
  });

  const openCount = incidentsQuery.data?.total ?? 0;
  const openIncidents = incidentsQuery.data?.data ?? [];

  const fleetLabel =
    user?.fleetName?.trim() || (user?.fleetId ? `Fleet ${user.fleetId.slice(0, 8)}` : 'Fleet');

  const routeContext = getRouteContext(pathname);

  // Close notification panel on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl+K for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-[880] border-b border-white/[0.04] bg-[#0a0e1a]/60 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        {/* Left: mobile menu + page context */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex rounded-lg p-2 text-ink-muted hover:text-ink hover:bg-white/5 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-lg font-bold text-ink">
                {routeContext.title}
              </h1>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint sm:inline-block">
                {routeContext.eyebrow}
              </span>
            </div>
            <p className="truncate text-xs text-ink-muted">
              {fleetLabel} &middot; {user?.role ?? 'Operator'}
            </p>
          </div>
        </div>

        {/* Center: search bar (desktop) */}
        <div className="hidden flex-1 justify-center md:flex">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex w-full max-w-md items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm text-ink-muted hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Search bikes, riders, events...</span>
            <kbd className="hidden rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-ink-faint lg:inline-block">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Mobile search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-ink-muted hover:text-ink hover:bg-white/5 md:hidden"
            aria-label="Search"
          >
            <Search size={16} />
          </button>

          <ConnectionIndicator />

          {/* Notifications bell */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative rounded-lg p-2 text-ink-muted hover:text-ink hover:bg-white/5 transition-all"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {openCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-ink px-1 text-[9px] font-bold text-white animate-pulse-soft">
                  {openCount > 9 ? '9+' : openCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/[0.08] bg-[#0f1524]/95 backdrop-blur-2xl shadow-2xl animate-scale-in overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <p className="text-sm font-bold text-ink">Open incidents</p>
                  <Badge label={`${openCount}`} tone="danger" />
                </div>
                <div className="dashboard-scrollbar max-h-72 overflow-y-auto">
                  {openIncidents.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-ink-muted">No open incidents</p>
                    </div>
                  ) : (
                    openIncidents.map((inc) => (
                      <a
                        key={inc.id}
                        href="/incidents"
                        className="flex items-start gap-3 border-b border-white/[0.03] px-4 py-3 hover:bg-white/[0.03] transition-colors"
                        onClick={() => setNotifOpen(false)}
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger-ink">
                          <Siren size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {inc.event?.type ?? 'Incident'} &middot; {inc.status}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {inc.createdAt ? formatTimeAgo(inc.createdAt) : 'Recently'}
                          </p>
                        </div>
                      </a>
                    ))
                  )}
                </div>
                {openCount > 5 && (
                  <a
                    href="/incidents"
                    className="flex items-center justify-center border-t border-white/[0.06] px-4 py-2.5 text-xs font-semibold text-accent hover:bg-white/[0.03]"
                    onClick={() => setNotifOpen(false)}
                  >
                    View all incidents &rarr;
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Open incidents chip */}
          <div className="hidden xl:block">
            <Badge
              label={`${openCount} open`}
              icon={<Siren size={12} />}
              tone={openCount > 0 ? 'danger' : 'neutral'}
            />
          </div>
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[990] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[10vh]" onClick={() => setSearchOpen(false)}>
          <div
            className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0f1524]/95 backdrop-blur-2xl shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
              <Search size={18} className="text-ink-muted" />
              <input
                type="text"
                autoFocus
                placeholder="Search bikes, riders, events, incidents..."
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-ink-muted">Start typing to search across your fleet...</p>
              <p className="mt-1 text-xs text-ink-faint">Bikes, riders, events, incidents, zones</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function getRouteContext(pathname: string) {
  if (pathname.startsWith('/live')) return { eyebrow: 'Command center', title: 'Live Map' };
  if (pathname.startsWith('/incidents')) return { eyebrow: 'Incident desk', title: 'Incidents' };
  if (pathname.startsWith('/bikes')) return { eyebrow: 'Fleet assets', title: 'Bikes' };
  if (pathname.startsWith('/devices')) return { eyebrow: 'Provisioning', title: 'Devices' };
  if (pathname.startsWith('/events')) return { eyebrow: 'Risk signals', title: 'Events' };
  if (pathname.startsWith('/zones')) return { eyebrow: 'Policy controls', title: 'Zones' };
  if (pathname.startsWith('/reports')) return { eyebrow: 'Reporting', title: 'Reports' };
  if (pathname.startsWith('/riders')) return { eyebrow: 'Fleet personnel', title: 'Riders' };
  if (pathname.startsWith('/audit')) return { eyebrow: 'Compliance', title: 'Audit Log' };
  if (pathname.startsWith('/settings')) return { eyebrow: 'Configuration', title: 'Settings' };
  return { eyebrow: 'Fleet overview', title: 'Overview' };
}
