'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, Bike, Menu, Radio, Search, Siren, Users, X, Zap, MapPin } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ConnectionIndicator } from '@/components/ui/connection-indicator';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { canUseFeature } from '@/lib/subscription';
import type { Incident, PaginatedResponse, SessionUser } from '@/lib/types/dashboard';
import { cx, formatTimeAgo } from '@/lib/ui';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const canViewIncidents = canUseFeature(user, 'incidents');

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'topbar-open'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=10'),
    enabled: canViewIncidents,
  });

  const openCount = canViewIncidents ? incidentsQuery.data?.total ?? 0 : 0;
  const openIncidents = canViewIncidents ? incidentsQuery.data?.data ?? [] : [];

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
    <header className="sticky top-0 z-[880] border-b border-line bg-nav-bg backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        {/* Left: mobile menu + page context */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex rounded-lg p-2 text-ink-muted hover:text-ink hover:bg-surface-hover lg:hidden"
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
            className="flex w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface-muted px-4 py-2 text-sm text-ink-muted hover:bg-surface-hover hover:border-line-strong transition-all"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Search bikes, riders, events...</span>
            <kbd className="hidden rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-ink-faint lg:inline-block">
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
            className="rounded-lg p-2 text-ink-muted hover:text-ink hover:bg-surface-hover md:hidden"
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
              className="relative rounded-lg p-2 text-ink-muted hover:text-ink hover:bg-surface-hover transition-all"
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
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-line bg-overlay-bg backdrop-blur-2xl shadow-2xl animate-scale-in overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
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
                        className="flex items-start gap-3 border-b border-line-faint px-4 py-3 hover:bg-surface-hover transition-colors"
                        onClick={() => setNotifOpen(false)}
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger-ink">
                          <Siren size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            Incident &middot; {inc.status}
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
                    className="flex items-center justify-center border-t border-line px-4 py-2.5 text-xs font-semibold text-accent hover:bg-surface-hover"
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
        <SearchOverlay
          query={searchQuery}
          user={user}
          onQueryChange={setSearchQuery}
          inputRef={searchInputRef}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery('');
          }}
          onNavigate={(href) => {
            router.push(href);
            setSearchOpen(false);
            setSearchQuery('');
          }}
        />
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

// ─── Search overlay with real API search ───────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'bike' | 'rider' | 'event' | 'incident' | 'zone' | 'device';
  label: string;
  sublabel: string;
  href: string;
  icon: ReactNode;
}

const SEARCH_ICONS: Record<SearchResult['type'], ReactNode> = {
  bike: <Bike size={14} />,
  rider: <Users size={14} />,
  event: <Radio size={14} />,
  incident: <Siren size={14} />,
  zone: <MapPin size={14} />,
  device: <Zap size={14} />,
};

function SearchOverlay({
  query,
  user,
  onQueryChange,
  inputRef,
  onClose,
  onNavigate,
}: {
  query: string;
  user: SessionUser | null | undefined;
  onQueryChange: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const debouncedQuery = useDebounce(query, 250);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { data: results = [], isLoading } = useQuery({
    queryKey: [
      'global-search',
      debouncedQuery,
      user?.fleetPlan,
      user?.subscriptionStatus,
    ],
    queryFn: () => globalSearch(debouncedQuery, user),
    enabled: debouncedQuery.length >= 2 && !!user,
    staleTime: 10_000,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      onNavigate(results[selectedIdx].href);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[990] flex items-start justify-center bg-black/30 backdrop-blur-sm pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-line bg-overlay-bg backdrop-blur-2xl shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <Search size={18} className="text-ink-muted" />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search bikes, riders, events, incidents..."
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="dashboard-scrollbar max-h-80 overflow-y-auto">
          {debouncedQuery.length < 2 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-ink-muted">Start typing to search across your fleet...</p>
              <p className="mt-1 text-xs text-ink-faint">
                Bikes, riders, events, incidents, devices, zones
              </p>
            </div>
          ) : isLoading ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-ink-muted">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-ink-muted">
                No results for &ldquo;{debouncedQuery}&rdquo;
              </p>
            </div>
          ) : (
            results.map((result, idx) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                onClick={() => onNavigate(result.href)}
                className={cx(
                  'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors',
                  idx === selectedIdx
                    ? 'bg-accent/10 text-accent'
                    : 'text-ink hover:bg-surface-hover',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                  {result.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{result.label}</p>
                  <p className="truncate text-xs text-ink-muted">{result.sublabel}</p>
                </div>
                <span className="shrink-0 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  {result.type}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function globalSearch(
  query: string,
  user: SessionUser | null | undefined,
): Promise<SearchResult[]> {
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  const [bikes, riders, events, incidents, zones, devices] = await Promise.allSettled([
    canUseFeature(user, 'bikes')
      ? apiFetch<PaginatedResponse<{ id: string; label: string; plate: string | null; status: string }>>('/bikes?page=1&pageSize=50')
      : Promise.resolve({ data: [] }),
    canUseFeature(user, 'riders')
      ? apiFetch<PaginatedResponse<{ id: string; fullName: string | null; email: string | null; phone: string | null; status: string }>>('/riders?page=1&pageSize=50')
      : Promise.resolve({ data: [] }),
    canUseFeature(user, 'events')
      ? apiFetch<PaginatedResponse<{ id: string; type: string; severity: string; bikeId: string | null; ts: string }>>('/events?page=1&pageSize=50')
      : Promise.resolve({ data: [] }),
    canUseFeature(user, 'incidents')
      ? apiFetch<PaginatedResponse<Incident>>('/incidents?page=1&pageSize=50')
      : Promise.resolve({ data: [] }),
    canUseFeature(user, 'zones')
      ? apiFetch<PaginatedResponse<{ id: string; name: string; type: string; active: boolean }>>('/zones?page=1&pageSize=50')
      : Promise.resolve({ data: [] }),
    canUseFeature(user, 'devices')
      ? apiFetch<PaginatedResponse<{ id: string; deviceUid: string; imei: string | null; status: string; bike: { id: string; label: string } | null }>>('/devices?page=1&pageSize=50')
      : Promise.resolve({ data: [] }),
  ]);

  if (bikes.status === 'fulfilled') {
    for (const b of bikes.value.data) {
      if (
        b.label.toLowerCase().includes(q) ||
        b.plate?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      ) {
        results.push({
          id: b.id,
          type: 'bike',
          label: b.label,
          sublabel: [b.plate, b.status].filter(Boolean).join(' · '),
          href: `/bikes`,
          icon: SEARCH_ICONS.bike,
        });
      }
    }
  }

  if (riders.status === 'fulfilled') {
    for (const r of riders.value.data) {
      const name = r.fullName || r.email || r.phone || 'Unknown';
      if (
        name.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q)
      ) {
        results.push({
          id: r.id,
          type: 'rider',
          label: name,
          sublabel: [r.email, r.status].filter(Boolean).join(' · '),
          href: `/riders`,
          icon: SEARCH_ICONS.rider,
        });
      }
    }
  }

  if (events.status === 'fulfilled') {
    for (const e of events.value.data) {
      const typeLabel = e.type.replace(/_/g, ' ');
      if (typeLabel.toLowerCase().includes(q) || e.severity.toLowerCase().includes(q)) {
        results.push({
          id: e.id,
          type: 'event',
          label: typeLabel,
          sublabel: `${e.severity} · ${new Date(e.ts).toLocaleString()}`,
          href: `/events`,
          icon: SEARCH_ICONS.event,
        });
      }
    }
  }

  if (incidents.status === 'fulfilled') {
    for (const inc of incidents.value.data) {
      const incLabel = `Incident ${inc.status}`;
      if (
        inc.status.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q) ||
        'incident'.includes(q)
      ) {
        results.push({
          id: inc.id,
          type: 'incident',
          label: incLabel,
          sublabel: new Date(inc.createdAt).toLocaleString(),
          href: `/incidents`,
          icon: SEARCH_ICONS.incident,
        });
      }
    }
  }

  if (zones.status === 'fulfilled') {
    for (const z of zones.value.data) {
      if (z.name.toLowerCase().includes(q) || z.type.toLowerCase().includes(q)) {
        results.push({
          id: z.id,
          type: 'zone',
          label: z.name,
          sublabel: `${z.type} · ${z.active ? 'Active' : 'Inactive'}`,
          href: `/zones`,
          icon: SEARCH_ICONS.zone,
        });
      }
    }
  }

  if (devices.status === 'fulfilled') {
    for (const d of devices.value.data) {
      if (
        d.deviceUid.toLowerCase().includes(q) ||
        d.imei?.toLowerCase().includes(q) ||
        d.bike?.label.toLowerCase().includes(q)
      ) {
        results.push({
          id: d.id,
          type: 'device',
          label: d.deviceUid,
          sublabel: [d.imei, d.bike?.label, d.status].filter(Boolean).join(' · '),
          href: `/devices`,
          icon: SEARCH_ICONS.device,
        });
      }
    }
  }

  return results.slice(0, 20);
}
