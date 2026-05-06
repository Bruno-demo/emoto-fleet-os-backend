'use client';

import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Globe,
  Key,
  Lock,
  Moon,
  Shield,
  Siren,
  Sun,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { getSubscriptionEntitlements } from '@/lib/subscription';
import { cx, formatEnumLabel } from '@/lib/ui';

type SettingsTab = 'profile' | 'fleet' | 'security' | 'notifications';

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'fleet', label: 'Fleet', icon: <Building2 size={15} /> },
  { id: 'security', label: 'Security', icon: <Shield size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
];

const DEFAULT_NOTIF_PREFS = {
  openIncidents: true,
  sosAlerts: true,
  crashEvents: true,
};

export default function SettingsPage() {
  const { data: user } = useCurrentUser();
  const entitlements = getSubscriptionEntitlements(user);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { setTheme, resolvedTheme } = useTheme();

  const [notifPrefs, setNotifPrefs] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_NOTIF_PREFS;
    }

    try {
      const stored = localStorage.getItem('emoto-notif-prefs');
      if (!stored) {
        return DEFAULT_NOTIF_PREFS;
      }

      return {
        ...DEFAULT_NOTIF_PREFS,
        ...(JSON.parse(stored) as Partial<typeof DEFAULT_NOTIF_PREFS>),
      };
    } catch {
      return DEFAULT_NOTIF_PREFS;
    }
  });

  const [useLocalTimezone, setUseLocalTimezone] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      const tz = localStorage.getItem('emoto-use-local-tz');
      return tz === null ? true : tz === 'true';
    } catch {
      return true;
    }
  });

  const updateNotifPref = (key: keyof typeof notifPrefs) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('emoto-notif-prefs', JSON.stringify(next));
      return next;
    });
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 rounded-2xl border border-line bg-surface-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-surface-strong text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-surface-hover',
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow="Account" title="Profile information">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent text-2xl font-bold">
                  {user?.email?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-ink">
                    {user?.email ?? 'Unknown user'}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {user?.role ? formatEnumLabel(user.role) : 'Operator'} &middot;{' '}
                    {user?.status ? formatEnumLabel(user.status) : 'Active'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Email" value={user?.email ?? 'Not set'} />
                <SettingsField label="Phone" value={user?.phone ?? 'Not set'} />
                <SettingsField
                  label="Role"
                  value={user?.role ? formatEnumLabel(user.role) : 'Unknown'}
                />
                <SettingsField
                  label="Status"
                  value={user?.status ? formatEnumLabel(user.status) : 'Unknown'}
                />
              </div>
            </div>
          </DashboardCard>

          <DashboardCard eyebrow="Preferences" title="Display settings">
            <div className="space-y-4">
              <SettingsToggle
                icon={isDark ? <Moon size={15} /> : <Sun size={15} />}
                label="Dark mode"
                description={isDark ? 'Using the dark interface theme' : 'Using the light interface theme'}
                checked={isDark}
                onChange={() => setTheme(isDark ? 'light' : 'dark')}
              />
              <SettingsToggle
                icon={<Globe size={15} />}
                label="Timezone"
                description="Dates display in your browser's local timezone"
                checked={useLocalTimezone}
                onChange={() => {
                  setUseLocalTimezone((v) => {
                    localStorage.setItem('emoto-use-local-tz', String(!v));
                    return !v;
                  });
                }}
              />
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Fleet */}
      {activeTab === 'fleet' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow="Organization" title="Fleet details">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Fleet ID" value={user?.fleetId ?? 'Unknown'} mono />
              <SettingsField
                label="Fleet name"
                value={user?.fleetName ?? 'Unnamed fleet'}
              />
              <SettingsField
                label="Plan"
                value={user?.fleetPlan ? formatEnumLabel(user.fleetPlan) : 'Unknown'}
              />
              <SettingsField
                label="Subscription"
                value={
                  user?.subscriptionStatus
                    ? formatEnumLabel(user.subscriptionStatus)
                    : 'Unknown'
                }
              />
            </div>
          </DashboardCard>

          <DashboardCard
            eyebrow="Subscription"
            title={`${entitlements.planLabel} usage`}
            description="Dashboard access is controlled by the fleet plan and subscription status."
            actions={
              entitlements.isPremium && entitlements.isActive ? null : (
                <Link
                  href={entitlements.isActive ? '/checkout?plan=operations-plus' : '/settings'}
                  className="inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
                >
                  {entitlements.isActive ? 'Upgrade plan' : 'Review billing'}
                </Link>
              )
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <FeatureList
                title="Included now"
                items={[
                  'Overview',
                  'Live map and alerts',
                  'Incident workflow',
                  'Events',
                  'Bikes and riders',
                  'Fleet settings',
                ]}
                active
              />
              <FeatureList
                title="Operations Plus"
                items={[
                  'Device provisioning',
                  'Geofence zones',
                  'Trip analytics and reports',
                  'Audit log',
                  'Evidence packs',
                  'Remote lock and unlock',
                ]}
                active={entitlements.isPremium && entitlements.isActive}
              />
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow="Authentication" title="Security settings">
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft text-success-ink">
                  <Lock size={16} />
                </span>
                <div>
                  <p className="font-semibold text-ink">Password</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Password management is handled through the authentication system.
                    Use the &ldquo;Forgot password&rdquo; flow to reset your credentials.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Key size={16} />
                </span>
                <div>
                  <p className="font-semibold text-ink">Session</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Your session is secured with an httpOnly cookie. Sessions expire
                    after inactivity. Account locks after 5 failed login attempts.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft text-warning-ink">
                  <Shield size={16} />
                </span>
                <div>
                  <p className="font-semibold text-ink">Role-based access</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Your role ({user?.role ? formatEnumLabel(user.role) : 'Operator'})
                    determines which actions and data you can access. Contact an admin
                    to change your role.
                  </p>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow="Alerts" title="Notification preferences">
            <div className="space-y-4">
              <SettingsToggle
                icon={<Siren size={15} />}
                label="Open incidents"
                description="Show incident count badge in the sidebar and topbar"
                checked={notifPrefs.openIncidents}
                onChange={() => updateNotifPref('openIncidents')}
              />
              <SettingsToggle
                icon={<Bell size={15} />}
                label="SOS alerts"
                description="Real-time notification when a rider triggers SOS"
                checked={notifPrefs.sosAlerts}
                onChange={() => updateNotifPref('sosAlerts')}
              />
              <SettingsToggle
                icon={<AlertTriangle size={15} />}
                label="Crash events"
                description="Immediate notification for crash detection events"
                checked={notifPrefs.crashEvents}
                onChange={() => updateNotifPref('crashEvents')}
              />
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Notification preferences are saved locally. Server-side notification
              delivery will be enabled in a future update.
            </p>
          </DashboardCard>
        </div>
      )}
    </div>
  );
}

function FeatureList({
  title,
  items,
  active,
}: {
  title: string;
  items: string[];
  active: boolean;
}) {
  return (
    <div
      className={cx(
        'rounded-[20px] border px-5 py-5',
        active
          ? 'border-success-ink/20 bg-success-soft/40'
          : 'border-line bg-surface-muted',
      )}
    >
      <div className="flex items-center gap-2">
        {active ? (
          <CheckCircle2 size={16} className="text-success-ink" />
        ) : (
          <Lock size={16} className="text-ink-muted" />
        )}
        <p className="text-sm font-bold text-ink">{title}</p>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-ink-soft">
            <span
              className={cx(
                'h-1.5 w-1.5 rounded-full',
                active ? 'bg-success-ink' : 'bg-ink-faint',
              )}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </p>
      <p
        className={cx(
          'mt-1.5 text-sm text-ink',
          mono && 'font-mono text-xs text-ink-muted',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SettingsToggle({
  icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={cx(
        'flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-surface-muted px-4 py-3 text-left transition-colors',
        !disabled && 'hover:bg-surface-hover cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-ink-muted">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
      </div>
      <div
        className={cx(
          'h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-ink-faint/40',
        )}
      >
        <div
          className={cx(
            'h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </div>
    </button>
  );
}
