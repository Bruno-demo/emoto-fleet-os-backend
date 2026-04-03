'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bike,
  ChevronLeft,
  ChevronRight,
  Command,
  FileBarChart2,
  LogOut,
  Map,
  MapPin,
  Radio,
  X,
} from 'lucide-react';
import { canManageZones } from '@/lib/auth/roles';
import { apiFetch } from '@/lib/api/client';
import { clearAuthToken } from '@/lib/auth/session';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { disconnectFleetSocket } from '@/lib/realtime/socket';
import { cx } from '@/lib/ui';

const NAV_LINKS = [
  { href: '/live', label: 'Live', icon: Map },
  { href: '/bikes', label: 'Bikes', icon: Bike },
  { href: '/incidents', label: 'Incidents', icon: AlertCircle },
  { href: '/events', label: 'Events', icon: Radio },
  { href: '/zones', label: 'Zones', icon: MapPin },
  { href: '/reports', label: 'Reports', icon: FileBarChart2 },
] as const;

interface DashboardNavProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function DashboardNav({
  collapsed,
  mobileOpen,
  onClose,
  onToggleCollapse,
}: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();

  // Clears current auth state and websocket connection before returning to login.
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

  const visibleLinks = NAV_LINKS.filter((link) => {
    if (link.href === '/zones' && user && !canManageZones(user.role)) {
      return false;
    }
    return true;
  });
  return (
    <>
      <div
        className={cx(
          'fixed inset-0 z-[900] bg-slate-950/30 backdrop-blur-[2px] transition-opacity lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-[950] flex h-full flex-col border-r border-line bg-surface shadow-[var(--shadow-strong)] transition-transform lg:translate-x-0',
          collapsed ? 'w-[84px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <Link href="/" onClick={onClose} className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-gradient-to-br from-accent to-accent-strong text-white shadow-lg">
              <Command size={20} />
            </span>
            {!collapsed ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
                  E-Moto Safety
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-ink">Fleet OS</h2>
              </div>
            ) : null}
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-line bg-surface-muted p-2 text-ink-soft hover:bg-surface-hover lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-2xl border border-line bg-surface-muted p-2 text-ink-soft hover:bg-surface-hover lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className="dashboard-scrollbar flex-1 overflow-y-auto px-3 py-2">
          <div className="grid gap-1.5">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={cx(
                    'group flex items-center gap-3 rounded-[16px] px-3 py-1.5 text-sm',
                    isActive
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-ink-soft hover:bg-surface-hover hover:text-ink',
                    collapsed && 'justify-center px-2',
                  )}
                >
                  <span
                    className={cx(
                      'rounded-2xl p-1.5',
                      isActive
                        ? 'bg-white/16 text-white'
                        : 'bg-surface-muted text-ink-soft group-hover:bg-white',
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  {!collapsed ? <span className="font-medium">{link.label}</span> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-line px-3 py-3">
          {!collapsed ? (
            <div className="rounded-[18px] bg-surface-muted px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Signed in
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">{user?.role ?? 'Operator'}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {user?.email ?? user?.phone ?? 'Authenticated user'}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className={cx(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-hover',
              collapsed && 'px-3',
            )}
          >
            <LogOut size={16} />
            {!collapsed ? 'Logout' : null}
          </button>
        </div>
      </aside>
    </>
  );
}
