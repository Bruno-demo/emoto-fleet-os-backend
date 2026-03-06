'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuthToken } from '@/lib/auth/session';
import { disconnectFleetSocket } from '@/lib/realtime/socket';

const NAV_LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/live', label: 'Live' },
  { href: '/bikes', label: 'Bikes' },
  { href: '/devices', label: 'Devices' },
  { href: '/events', label: 'Events' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/zones', label: 'Zones' },
  { href: '/reports', label: 'Reports' },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Clears current auth state and websocket connection before returning to login.
  const handleLogout = () => {
    disconnectFleetSocket();
    clearAuthToken();
    router.replace('/login');
  };

  return (
    <aside className="border-b border-line bg-surface/95 p-4 backdrop-blur md:min-h-screen md:border-r md:border-b-0 md:p-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.2em] text-accent">
          eMoto Fleet OS
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Dashboard</h2>
      </div>

      <nav className="mt-6 grid gap-2">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-accent text-white'
                  : 'bg-transparent text-ink-soft hover:bg-surface-muted hover:text-ink'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink transition hover:bg-surface-muted"
      >
        Logout
      </button>
    </aside>
  );
}
