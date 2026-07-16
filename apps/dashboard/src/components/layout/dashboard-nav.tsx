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
  DollarSign,
  FileBarChart2,
  Gauge,
  Lock,
  LogOut,
  Map,
  MapPin,
  Radio,
  Route,
  Search,
  Settings,
  Shield,
  Users,
  X,
  Zap,
  Package,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { canManageZones } from '@/lib/auth/roles';
import { apiFetch } from '@/lib/api/client';
import { clearAuthToken } from '@/lib/auth/session';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { disconnectFleetSocket } from '@/lib/realtime/socket';
import { canUseFeature, getSubscriptionEntitlements, type DashboardFeature } from '@/lib/subscription';
import { cx } from '@/lib/ui';
import { useTranslation } from '../i18n/LanguageProvider';

interface NavGroup {
  label: string;
  links: NavLink[];
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  feature: DashboardFeature;
  badge?: number;
  requiresAdmin?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    links: [
      { href: '/overview', label: 'Overview', icon: Gauge, feature: 'overview' },
      { href: '/insurer/lookup', label: 'Lookup', icon: Search, feature: 'overview' },
      { href: '/live', label: 'Live Map', icon: Map, feature: 'live' },
      { href: '/deliveries', label: 'Deliveries', icon: Package, feature: 'overview' },
      { href: '/incidents', label: 'Incidents', icon: AlertCircle, feature: 'incidents' },
    ],
  },
  {
    label: 'Fleet',
    links: [
      { href: '/bikes', label: 'Bikes', icon: Bike, feature: 'bikes' },
      { href: '/riders', label: 'Riders', icon: Users, feature: 'riders' },
      { href: '/trips', label: 'Trips', icon: Route, feature: 'bikes' },
      { href: '/devices', label: 'Devices', icon: Zap, feature: 'devices' },
    ],
  },
  {
    label: 'Intelligence',
    links: [
      { href: '/reports', label: 'Reports', icon: FileBarChart2, feature: 'reports' },
      { href: '/events', label: 'Events', icon: Radio, feature: 'events' },
    ],
  },
  {
    label: 'Management',
    links: [
      { href: '/zones', label: 'Zones', icon: MapPin, feature: 'zones', requiresAdmin: true },
      { href: '/financial', label: 'Financials', icon: DollarSign, feature: 'financial', requiresAdmin: true },
      { href: '/audit', label: 'Audit Log', icon: ClipboardList, feature: 'audit', requiresAdmin: true },
      { href: '/settings', label: 'Settings', icon: Settings, feature: 'settings', requiresAdmin: true },
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
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const getLinkLabel = (link: NavLink) => {
    const key = link.href.replace('/', '');
    if (key === 'live') return t('nav_live_map');
    return t(`nav_${key}`, link.label);
  };
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const entitlements = getSubscriptionEntitlements(user);

  const handleLogout = async () => {
    disconnectFleetSocket();
    try {
      await apiFetch('/auth/logout', { method: 'POST' }, { auth: false });
    } catch {
      // Ignore logout errors; session cookie will expire server-side.
    }
    clearAuthToken();
    queryClient.clear();
    router.replace('/login');
  };

  const isLinkVisible = (link: NavLink) => {
    if (user?.role === 'INSURER') {
      const allowedPaths = ['/overview', '/bikes', '/events', '/incidents', '/trips', '/reports', '/settings', '/insurer/lookup'];
      return allowedPaths.includes(link.href);
    }
    if (link.href === '/insurer/lookup') {
      return false;
    }
    if (link.href === '/deliveries' && user?.fleetType !== 'DELIVERY') {
      return false;
    }
    if (link.href === '/financial' && user?.fleetType !== 'COOP' && user?.fleetType !== 'DELIVERY') {
      return false;
    }
    if (link.requiresAdmin && user && !canManageZones(user.role)) return false;
    return true;
  };

  const isActive = (href: string) => {
    if (href === '/overview') return pathname === '/overview';
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
          'fixed inset-y-0 left-0 z-[950] flex h-full flex-col border-r border-line bg-nav-bg backdrop-blur-[40px] transition-all duration-300 lg:translate-x-0',
          collapsed ? 'w-[76px]' : 'w-[272px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Link href="/overview" onClick={onClose} className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-ink shadow-lg shadow-accent/20 group-hover:shadow-accent/40 transition-shadow">
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
              className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>

        {/* Navigation groups */}
        <nav className="dashboard-scrollbar flex-1 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((group, groupIdx) => {
            const visibleLinks = group.links.filter(isLinkVisible);
            if (visibleLinks.length === 0) return null;
            return (
              <div key={group.label} className="mb-5">
                {groupIdx > 0 && (
                  <div className={cx('my-4 border-t border-line/30', collapsed ? 'mx-1' : 'mx-3')} />
                )}
                {!collapsed && (
                  <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
                    {t('nav_group_' + group.label.toLowerCase(), group.label)}
                  </p>
                )}
                <div className="grid gap-0.5">
                  {visibleLinks.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.href);
                    const badge = getBadge(link.href);
                    const locked = user ? !canUseFeature(user, link.feature) : false;
                    const translatedLabel = getLinkLabel(link);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onClose}
                        title={collapsed ? translatedLabel : undefined}
                        className={cx(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all',
                          active
                            ? 'bg-accent/[0.12] text-accent'
                            : locked
                              ? 'text-ink-faint hover:bg-surface-hover hover:text-ink-soft'
                              : 'text-ink-soft hover:bg-surface-hover hover:text-ink',
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
                            <span className="flex-1">{translatedLabel}</span>
                            {locked ? (
                              <Lock size={13} className="text-ink-faint" />
                            ) : badge !== undefined ? (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-soft px-1.5 text-[10px] font-bold text-danger-ink">
                                {badge > 99 ? '99+' : badge}
                              </span>
                            ) : null}
                          </>
                        )}
                        {collapsed && locked && (
                          <span className="absolute -right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-muted text-ink-faint">
                            <Lock size={9} />
                          </span>
                        )}
                        {collapsed && !locked && badge !== undefined && (
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
        <div className="border-t border-line p-3">
          {!collapsed ? (
            <div className="mb-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent font-bold text-sm">
                  {(user?.email ?? user?.phone ?? 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {user?.email ?? user?.phone ?? 'User'}
                  </p>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Shield size={10} className="text-accent" />
                      <p className="text-[11px] text-ink-muted">{roleLabel}</p>
                    </div>
                    {user && (
                      <p className="text-[10px] font-semibold text-ink-muted/80">
                        {entitlements.planLabel} &middot;{' '}
                        <span
                          className={cx(
                            entitlements.isActive ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          {entitlements.statusLabel}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {user?.fleetName === 'E-Moto HQ' && (
                <Link
                  href="/hq/overview"
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent text-white px-3 py-2 text-[13px] font-semibold hover:bg-accent-strong transition-all shadow-sm"
                >
                  <Zap size={14} className="fill-current" />
                  {t('nav_superadmin', 'Enter HQ')}
                </Link>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className={cx(
              'flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-surface-hover hover:text-ink transition-all',
              collapsed && 'px-0',
            )}
          >
            <LogOut size={14} className="text-danger-ink" />
            {!collapsed ? t('nav_logout', 'Sign out') : null}
          </button>
        </div>
      </aside>
    </>
  );
}

