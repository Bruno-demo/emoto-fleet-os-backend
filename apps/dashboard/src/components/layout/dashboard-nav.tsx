'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bike,
  FileBarChart2,
  Home,
  LogOut,
  Map,
  MapPin,
  Radio,
  Router,
} from 'lucide-react';
import { canManageZones } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { clearAuthToken } from '@/lib/auth/session';
import { disconnectFleetSocket } from '@/lib/realtime/socket';

const NAV_LINKS = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/live', label: 'Live Ops', icon: Map },
  { href: '/bikes', label: 'Bikes', icon: Bike },
  { href: '/devices', label: 'Devices', icon: Router },
  { href: '/events', label: 'Events', icon: Radio },
  { href: '/incidents', label: 'Incidents', icon: AlertCircle },
  { href: '/zones', label: 'Zones', icon: MapPin },
  { href: '/reports', label: 'Reports', icon: FileBarChart2 },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();

  // Clears current auth state and websocket connection before returning to login.
  const handleLogout = () => {
    disconnectFleetSocket();
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
    <aside className="border-b border-line bg-white shadow-[var(--shadow)] md:sticky md:top-0 md:flex md:min-h-screen md:flex-col md:border-r md:border-b-0">
      <div className="bg-gradient-to-br from-accent to-accent-strong px-5 py-6 text-white md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100">
          Emoto Fleet
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold">Dispatcher Portal</h2>
        <p className="mt-1 text-sm text-blue-100">
          Live telemetry, incidents, and command operations.
        </p>
      </div>

      <nav className="grid gap-2 overflow-x-auto px-3 py-4 md:flex-1 md:px-4 md:py-5">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex min-w-fit items-center gap-3 rounded-2xl px-4 py-3 text-sm transition md:min-w-0 ${
                isActive
                  ? 'bg-accent-soft text-accent shadow-sm'
                  : 'text-ink-soft hover:bg-surface-muted hover:text-ink'
              }`}
            >
              <span
                className={`rounded-xl p-2 ${
                  isActive ? 'bg-white text-accent' : 'bg-surface-muted text-ink-soft'
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-4 py-4">
        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Signed In</p>
          <p className="mt-2 text-sm font-semibold text-ink">{user?.role ?? 'Operator'}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {user?.email ?? user?.phone ?? 'Authenticated user'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
