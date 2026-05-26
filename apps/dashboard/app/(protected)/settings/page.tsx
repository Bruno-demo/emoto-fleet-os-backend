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
  UserPlus,
  Users,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { getSubscriptionEntitlements } from '@/lib/subscription';
import { cx, formatEnumLabel } from '@/lib/ui';

type SettingsTab = 'profile' | 'fleet' | 'team' | 'security' | 'notifications';

const ALL_TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'fleet', label: 'Fleet', icon: <Building2 size={15} /> },
  { id: 'team', label: 'Team', icon: <Users size={15} />, adminOnly: true },
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
      <div className="flex overflow-x-auto dashboard-scrollbar gap-1 rounded-2xl border border-line bg-surface-muted p-1 whitespace-nowrap">
        {ALL_TABS.filter(tab => !tab.adminOnly || (user && (user.role === 'ADMIN' || user.role === 'OWNER'))).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shrink-0',
              activeTab === tab.id
                ? 'bg-surface-strong text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-surface-hover',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
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
                value={entitlements.planLabel}
              />
              <SettingsField
                label="Subscription"
                value={entitlements.statusLabel}
              />
            </div>
          </DashboardCard>

          <DashboardCard
            eyebrow="Subscription"
            title="Compare Plans"
            description="View and compare the different service levels available for E-Moto Fleet OS."
          >
            <div className="grid gap-6 md:grid-cols-3">
              {/* Safety Core Card */}
              <div
                className={cx(
                  'rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden',
                  !entitlements.isPremium && entitlements.isActive
                    ? 'border-success-ink/20 bg-success-soft/10 ring-1 ring-success-ink/25 shadow-lg shadow-success-soft/5'
                    : 'border-line bg-surface-muted/50 hover:bg-surface-muted hover:border-line-strong'
                )}
              >
                {!entitlements.isPremium && entitlements.isActive && (
                  <div className="absolute top-0 right-0 bg-success-ink text-white font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                    Active Plan
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={!entitlements.isPremium && entitlements.isActive ? "text-success-ink" : "text-ink-muted"} />
                    <p className="text-sm font-bold text-ink">Safety Core</p>
                  </div>
                  <div className="mt-4 flex flex-col items-start gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-ink">10,000 RWF</span>
                      <span className="text-xs text-ink-muted">/ bike / month</span>
                    </div>
                    <span className="text-[10px] font-bold text-success-ink">+ 50,000 RWF device setup & install</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                    Essential telemetry, safety event detection, and manual incident response tools.
                  </p>
                  
                  <div className="h-px w-full bg-line my-4" />
                  
                  <ul className="space-y-2.5 text-xs text-ink-soft">
                    {['Overview Dashboard', 'Live Map Tracking', 'Incident Escalation', 'Risk Events Feed', 'Bikes & Riders Directory', 'Fleet Configuration'].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-success-ink shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {['Device provisioning', 'Policy geofencing', 'Remote commands', 'Audit logs'].map((f) => (
                      <li key={f} className="flex items-center gap-2 opacity-50">
                        <Lock size={10} className="text-ink-faint shrink-0" />
                        <span className="line-through">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-6">
                  {!entitlements.isPremium && entitlements.isActive ? (
                    <button
                      type="button"
                      disabled
                      className="w-full text-center rounded-xl bg-success-soft text-success-ink border border-success-ink/20 py-2 text-xs font-bold"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full text-center rounded-xl border border-line bg-surface-muted text-ink-muted py-2 text-xs font-semibold"
                    >
                      Included in higher tier
                    </button>
                  )}
                </div>
              </div>

              {/* Operations Plus Card */}
              <div
                className={cx(
                  'rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden',
                  entitlements.isPremium && entitlements.isActive
                    ? 'border-success-ink/20 bg-success-soft/10 ring-1 ring-success-ink/25 shadow-lg shadow-success-soft/5'
                    : 'border-accent/25 bg-accent/5 hover:bg-accent/[0.08] hover:border-accent'
                )}
              >
                {entitlements.isPremium && entitlements.isActive && (
                  <div className="absolute top-0 right-0 bg-success-ink text-white font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                    Active Plan
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-accent" />
                    <p className="text-sm font-bold text-ink">Operations Plus</p>
                  </div>
                  <div className="mt-4 flex flex-col items-start gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-ink">25,000 RWF</span>
                      <span className="text-xs text-ink-muted">/ bike / month</span>
                    </div>
                    <span className="text-[10px] font-bold text-accent">+ 50,000 RWF device setup & install</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                    Unlocks device configuration, strict geofence speed caps, trip analytics, and remote commands.
                  </p>
                  
                  <div className="h-px w-full bg-line my-4" />
                  
                  <ul className="space-y-2.5 text-xs text-ink-soft">
                    <li className="flex items-center gap-2 text-accent font-semibold">
                      <CheckCircle2 size={12} className="text-accent shrink-0" />
                      <span>Everything in Safety Core</span>
                    </li>
                    {['Device Provisioning (SIMs/Hardware)', 'Policy Geofencing (Speed/Parking)', 'Trip Analytics & Reports', 'Immutable Compliance Audit Logs', 'Remote Commands (Lock/Unlock/Sound)', 'Incident Evidence Packs'].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-accent shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-6">
                  {entitlements.isPremium && entitlements.isActive ? (
                    <button
                      type="button"
                      disabled
                      className="w-full text-center rounded-xl bg-success-soft text-success-ink border border-success-ink/20 py-2 text-xs font-bold"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <Link
                      href="/checkout?plan=operations-plus"
                      className="block w-full text-center rounded-xl bg-accent hover:brightness-110 text-white py-2 text-xs font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
                    >
                      Upgrade Plan
                    </Link>
                  )}
                </div>
              </div>

              {/* Enterprise Card */}
              <div className="rounded-[20px] border border-line bg-surface-muted/50 hover:bg-surface-muted hover:border-line-strong p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-ink-muted" />
                    <p className="text-sm font-bold text-ink">Enterprise</p>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-ink">Custom</span>
                    <span className="text-xs text-ink-muted">pricing</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                    Custom scale telemetry ingestion, developer API gateway keys, and dedicated enterprise SLA support.
                  </p>
                  
                  <div className="h-px w-full bg-line my-4" />
                  
                  <ul className="space-y-2.5 text-xs text-ink-soft">
                    <li className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={12} className="text-ink-muted shrink-0" />
                      <span>Everything in Operations Plus</span>
                    </li>
                    {['Partner API & Access Token Keys', 'Dedicated Customer Support Manager', '99.9% Uptime Guarantee SLA', 'Custom Telemetry Connectors & Feeds', 'Volume Discounts for Large Fleets'].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-success-ink shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-6">
                  <a
                    href="mailto:sales@emotofleet.com?subject=Enterprise%20Plan%20Inquiry"
                    className="block w-full text-center rounded-xl border border-line bg-surface hover:bg-surface-hover text-ink py-2 text-xs font-bold transition-all hover:scale-[1.02]"
                  >
                    Contact Sales
                  </a>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Team */}
      {activeTab === 'team' && user && (user.role === 'ADMIN' || user.role === 'OWNER') && (
        <TeamTab currentUser={user} />
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

// ── Team Management ──────────────────────────────────────────────────

interface FleetUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'DISPATCHER', 'TECH', 'RIDER'];

function TeamTab({ currentUser }: { currentUser: { id: string; role: string; fleetId: string } }) {
  const queryClient = useQueryClient();
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['fleet-users'],
    queryFn: () => apiFetch<FleetUser[]>('/auth/fleet-users'),
  });

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleError(null);
    setChangingRoleFor(userId);
    try {
      await apiFetch(`/auth/fleet-users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      await queryClient.invalidateQueries({ queryKey: ['fleet-users'] });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setRoleError(error.message);
      } else {
        setRoleError('Failed to change role');
      }
    } finally {
      setChangingRoleFor(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <DashboardCard eyebrow="Organization" title="Team members" description="Manage users in your fleet. Change roles to control access levels.">
        {roleError && (
          <p className="mb-4 rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{roleError}</p>
        )}

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 w-full rounded-xl bg-surface-muted" />
            ))}
          </div>
        ) : !members?.length ? (
          <p className="py-8 text-center text-sm text-ink-muted">No team members found.</p>
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
            {members.map((member) => {
              const isCurrentUser = member.id === currentUser.id;
              return (
                <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-4 bg-surface-muted hover:bg-surface-hover transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent text-sm font-bold">
                      {(member.email?.[0] ?? member.phone?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {member.email ?? member.phone ?? 'Unknown'}
                        {isCurrentUser && <span className="ml-2 text-xs text-ink-muted">(you)</span>}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatEnumLabel(member.status)} · Joined {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isCurrentUser ? (
                      <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                        {formatEnumLabel(member.role)}
                      </span>
                    ) : (
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          disabled={changingRoleFor === member.id}
                          className="appearance-none rounded-xl border border-line bg-surface px-3 py-1.5 pr-8 text-xs font-semibold text-ink outline-none transition focus:border-accent disabled:opacity-50 cursor-pointer"
                        >
                          {ROLE_OPTIONS.map(role => (
                            <option key={role} value={role}>{formatEnumLabel(role)}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-ink-faint">
          {members?.length ?? 0} members in this fleet. Use role assignments to control feature access.
        </p>
      </DashboardCard>
    </div>
  );
}

