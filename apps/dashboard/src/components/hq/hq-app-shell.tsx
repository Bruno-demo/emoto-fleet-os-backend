'use client';

import { 
  AlertTriangle,
  Building2, 
  ClipboardList,
  Command,
  Cpu,
  LayoutDashboard, 
  LogOut, 
  Menu, 
  Activity, 
  Users, 
  UserPlus, 
  ShieldCheck,
  Zap,
  Globe,
  MapPin,
  Banknote,
  Bike
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { clearAuthToken } from '@/lib/auth/session';
import { cx } from '@/lib/ui';
import { useCurrentUser } from '@/lib/auth/use-current-user';

const HQ_NAV_LINKS = [
  { href: '/hq/overview', label: 'Command Center', icon: LayoutDashboard },
  { href: '/hq/fleets', label: 'Fleets', icon: Building2 },
  { href: '/hq/billing', label: 'Billing & Subscriptions', icon: Banknote },
  { href: '/hq/users', label: 'Users', icon: Users },
  { href: '/hq/riders', label: 'Riders', icon: Bike },
  { href: '/hq/devices', label: 'Devices', icon: Cpu },
  { href: '/hq/pending-setups', label: 'Pending Setups', icon: UserPlus },
  { href: '/hq/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/hq/events', label: 'Events', icon: Zap },
  { href: '/hq/audit', label: 'Audit Log', icon: ClipboardList },
  { href: '/hq/partners', label: 'Partners & APIs', icon: Globe },
  { href: '/hq/pois', label: 'Help Points (POIs)', icon: MapPin },
  { href: '/hq/insurers', label: 'Insurers', icon: ShieldCheck },
  { href: '/hq/monitoring', label: 'Monitoring', icon: Activity },
];

export function HqAppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user } = useCurrentUser();

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
    } catch {
      // Ignore logout errors
    }
    clearAuthToken();
    queryClient.clear();
    router.replace('/login');
  };

  return (
    <div className="dark min-h-screen bg-[#09090b] text-white">
      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#09090b]/80 px-4 backdrop-blur-xl lg:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <Link href="/hq/overview" className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-ink shadow-lg shadow-accent/20 group-hover:shadow-accent/40 transition-shadow">
              <Command size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                E-Moto
              </p>
              <p className="font-display text-sm font-bold text-white">HQ</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-sm font-medium">{user?.email ?? user?.phone}</span>
            <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              Super Admin
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Backdrop (Mobile) */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cx(
            'fixed inset-y-0 left-0 z-50 w-64 border-r border-white/[0.08] bg-[#09090b] transition-transform lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-full flex-col p-4">
            <nav className="flex-1 space-y-1 overflow-y-auto dashboard-scrollbar pr-1">
              {HQ_NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/[0.08] pt-4 space-y-1">
              <Link
                href="/overview"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <LayoutDashboard size={18} />
                Return to Fleet View
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger-ink hover:bg-danger-ink/10 transition-colors"
              >
                <LogOut size={18} />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

