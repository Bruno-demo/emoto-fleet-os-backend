'use client';

import {
  AlertTriangle,
  Bell,
  Building2,
  Globe,
  Key,
  Lock,
  Moon,
  Palette,
  Shield,
  Siren,
  Sun,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { cx, formatEnumLabel } from '@/lib/ui';

type SettingsTab = 'profile' | 'fleet' | 'security' | 'notifications';

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'fleet', label: 'Fleet', icon: <Building2 size={15} /> },
  { id: 'security', label: 'Security', icon: <Shield size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
];

export default function SettingsPage() {
  const { data: user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-white/[0.08] text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-white/[0.04]',
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
                icon={<Moon size={15} />}
                label="Dark mode"
                description="Currently using the dark interface theme"
                checked={true}
                disabled
              />
              <SettingsToggle
                icon={<Globe size={15} />}
                label="Timezone"
                description="Dates display in your browser's local timezone"
                checked={true}
                disabled
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
        </div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow="Authentication" title="Security settings">
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
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

              <div className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
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

              <div className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
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
                checked={true}
                disabled
              />
              <SettingsToggle
                icon={<Bell size={15} />}
                label="SOS alerts"
                description="Real-time notification when a rider triggers SOS"
                checked={true}
                disabled
              />
              <SettingsToggle
                icon={<AlertTriangle size={15} />}
                label="Crash events"
                description="Immediate notification for crash detection events"
                checked={true}
                disabled
              />
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Notification preferences will be configurable in a future update.
              Currently, all alert types are enabled by default.
            </p>
          </DashboardCard>
        </div>
      )}
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
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
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-ink-muted">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
      </div>
      <div
        className={cx(
          'h-6 w-10 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-white/10',
          disabled && 'opacity-60',
        )}
      >
        <div
          className={cx(
            'h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </div>
    </div>
  );
}
