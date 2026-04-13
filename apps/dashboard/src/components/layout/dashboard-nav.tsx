'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bike,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Command,
  FileBarChart2,
  Gauge,
  LogOut,
  Map,
  MapPin,
  Radio,
  Settings,
  Shield,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { canManageZones } from '@/lib/auth/roles';
import { apiFetch } from '@/lib/api/client';
import { clearAuthToken } from '@/lib/auth/session';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { disconnectFleetSocket } from '@/lib/realtime/socket';
import { cx } from '@/lib/ui';

interface NavGroup {
  label: string;
  links: NavLink[];
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  badge?: number;
  requiresAdmin?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    links: [
      { href: '/', label: 'Overview', icon: Gauge },
      { href: '/live', label: 'Live Map', icon: Map },
      { href: '/incidents', label: 'Incidents', icon: AlertCircle },
      { href: '/events', label: 'Events', icon: Radio },
    ],
  },
  {
    label: 'Fleet',
    links: [
      { href: '/bikes', label: 'Bikes', icon: Bike },
      { href: '/riders', label: 'Riders', icon: Users },
      { href: '/devices', label: 'Devices', icon: Zap },
    ],
  },
  {
    label: 'Management',
    links: [
      { href: '/zones', label: 'Zones', icon: MapPin, requiresAdmin: true },
      { href: '/reports', label: 'Reports', icon: FileBarChart2 },
      { href: '/audit', label: 'Audit Log', icon: ClipboardList, requiresAdmin: true },
      { href: '/settings', label: 'Settings', icon: Settings, requiresAdmin: true },
    ],
  },
];

interface DashboardNavProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  openIncidentCount?: number;
}

export function DashboardNav({
  collapsed,
  mobileOpen,
  onClose,
  onToggleCollapse,
  openIncidentCount = 0,
}: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();

  const handleLogout = async () => {
    disconnectFleetSocket();
    try {
      await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
    } catch {
      // Ignore logout errors; session cookie will expire server-side.
    }
    clearAuthToken();
    router.replace('/login');
  };

  const isLinkVisible = (link: NavLink) => {
    if (link.requiresAdmin && user && !canManageZones(user.role)) return false;
    return true;
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname.startsWith(href);
  };

  const getBadge = (href: string) => {
    if (href === '/incidents' && openIncidentCount > 0) return openIncidentCount;
    return undefined;
  };

  const roleLabel = user?.role
    ? user.role.charAt(0) + user.role.slice(1).toLowerCase()
    : 'Operator';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cx(
          'fixed inset-0 z-[900] bg-black/40 backdrop-blur-[3px] transition-opacity lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-[950] flex h-full flex-col border-r border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-[40px] transition-all duration-300 lg:translate-x-0',
          collapsed ? 'w-[76px]' : 'w-[272px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-4">
          <Link href="/" onClick={onClose} className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-white shadow-lg shadow-accent/20 group-hover:shadow-accent/40 transition-shadow">
              <Command size={18} />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                  E-Moto
                </p>
                <p className="font-display text-sm font-bold text-ink">Fleet OS</p>
              </div>
            )}
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-white/5 lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-white/5 lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>

        {/* Navigation groups */}
        <nav className="dashboard-scrollbar flex-1 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((group) => {
            const visibleLinks = group.links.filter(isLinkVisible);
            if (visibleLinks.length === 0) return null;
            return (
              <div key={group.label} className="mb-5">
                {!collapsed && (
                  <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
                    {group.label}
                  </p>
                )}
                <div className="grid gap-0.5">
                  {visibleLinks.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.href);
                    const badge = getBadge(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onClose}
                        title={collapsed ? link.label : undefined}
                        className={cx(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all',
                          active
                            ? 'bg-accent/[0.12] text-accent'
                            : 'text-ink-soft hover:bg-white/[0.04] hover:text-ink',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                        )}
                        <span
                          className={cx(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                            active
                              ? 'bg-accent/20 text-accent'
                              : 'text-ink-muted group-hover:text-ink-soft',
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        {!collapsed && (
                          <>
                            <span className="flex-1">{link.label}</span>
                            {badge !== undefined && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-soft px-1.5 text-[10px] font-bold text-danger-ink">
                                {badge > 99 ? '99+' : badge}
                              </span>
                            )}
                          </>
                        )}
                        {collapsed && badge !== undefined && (
                          <span className="absolute -right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-ink px-1 text-[9px] font-bold text-white">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-white/[0.06] p-3">
          {!collapsed ? (
            <div className="mb-2.5 flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent font-bold text-sm">
                {(user?.email ?? user?.phone ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {user?.email ?? user?.phone ?? 'User'}
                </p>
                <div className="flex items-center gap-1.5">
                  <Shield size={10} className="text-accent" />
                  <p className="text-[11px] text-ink-muted">{roleLabel}</p>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className={cx(
              'flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-white/[0.04] hover:text-ink transition-all',
              collapsed && 'px-0',
            )}
          >
            <LogOut size={14} className="text-danger-ink" />
            {!collapsed ? 'Sign out' : null}
          </button>
        </div>
      </aside>
    </>
  );
}
