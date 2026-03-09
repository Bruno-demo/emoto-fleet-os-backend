'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  KeyRound,
  Link2,
  Radio,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { canProvisionDevices } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { Device, PaginatedResponse } from '@/lib/types/dashboard';

const PAGE_SIZE = 20;

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [deviceUid, setDeviceUid] = useState('');
  const [imei, setImei] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [lastProvisionedSecret, setLastProvisionedSecret] = useState<string | null>(null);

  const devicesQuery = useQuery({
    queryKey: ['devices', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Device>>(
        `/devices${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
  });

  const canProvision = currentUser ? canProvisionDevices(currentUser.role) : false;

  const deviceStats = useMemo(() => {
    const devices = devicesQuery.data?.data ?? [];
    const recentCutoff = Date.now() - 10 * 60 * 1000;
    return {
      total: devicesQuery.data?.total ?? 0,
      active: devices.filter((device) => device.status === 'ACTIVE').length,
      assigned: devices.filter((device) => !!device.bikeId).length,
      recentlySeen: devices.filter((device) => {
        if (!device.lastSeenAt) {
          return false;
        }
        return Date.parse(device.lastSeenAt) >= recentCutoff;
      }).length,
    };
  }, [devicesQuery.data?.data, devicesQuery.data?.total]);

  const devices = devicesQuery.data?.data ?? [];

  // Creates a device and exposes the one-time provisioning secret to authorized roles.
  const createDevice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setLastProvisionedSecret(null);

    if (!deviceUid.trim()) {
      setCreateError('deviceUid is required');
      return;
    }

    try {
      setIsCreating(true);
      const response = await apiFetch<{ device: Device; deviceSecret: string }>('/devices', {
        method: 'POST',
        body: JSON.stringify({
          deviceUid: deviceUid.trim(),
          imei: imei.trim() || undefined,
        }),
      });

      setDeviceUid('');
      setImei('');
      setLastProvisionedSecret(response.deviceSecret);
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setCreateError(error.message);
      } else {
        setCreateError('Unable to provision device');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <PageShell
      title="Devices"
      description="Provision telemetry hardware, review assignment health, and track which units are reporting into the fleet."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Registered Devices"
          value={String(deviceStats.total)}
          hint="Total devices visible in the current fleet."
          icon={<Cpu size={18} />}
          tone="info"
        />
        <MetricCard
          title="Active"
          value={String(deviceStats.active)}
          hint="Devices marked active and eligible for telemetry ingest."
          icon={<ShieldCheck size={18} />}
          tone="success"
        />
        <MetricCard
          title="Assigned"
          value={String(deviceStats.assigned)}
          hint="Devices currently attached to a bike record."
          icon={<Link2 size={18} />}
          tone="info"
        />
        <MetricCard
          title="Seen < 10 Min"
          value={String(deviceStats.recentlySeen)}
          hint="Devices with a fresh heartbeat in the recent window."
          icon={<Radio size={18} />}
          tone="warning"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Device Registry
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
                Provisioned hardware
              </h2>
            </div>
            <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
              Page {devicesQuery.data?.page ?? page} of {devicesQuery.data?.totalPages ?? 1}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.16em] text-ink-soft">
                  <th className="px-3 py-3">Device</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Bike</th>
                  <th className="px-3 py-3">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} className="border-b border-line/70 last:border-b-0">
                    <td className="px-3 py-4">
                      <div className="flex items-start gap-3">
                        <span className="rounded-2xl bg-accent-soft p-2 text-accent">
                          <Smartphone size={18} />
                        </span>
                        <div>
                          <p className="font-medium text-ink">{device.deviceUid}</p>
                          <p className="mt-1 text-xs text-ink-soft">
                            {device.imei ?? device.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill
                        label={device.status}
                        tone={device.status === 'ACTIVE' ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="px-3 py-4 text-ink-soft">
                      {device.bike?.label ?? 'Unassigned'}
                    </td>
                    <td className="px-3 py-4 text-ink-soft">
                      {device.lastSeenAt ? formatTimestamp(device.lastSeenAt) : 'Never'}
                    </td>
                  </tr>
                ))}
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-ink-soft">
                      No devices have been provisioned for this fleet yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={devicesQuery.data?.page ?? page}
            totalPages={devicesQuery.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </article>

        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Provisioning
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
            Create a new device identity
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Provisioning returns a one-time device secret. Store it securely during technician handoff.
          </p>

          {canProvision ? (
            <form className="mt-5 space-y-4" onSubmit={createDevice}>
              <div className="rounded-3xl border border-line bg-surface-muted p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                  Device UID
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="EMOTO-DEV-001"
                  value={deviceUid}
                  onChange={(event) => setDeviceUid(event.target.value)}
                />
              </div>

              <div className="rounded-3xl border border-line bg-surface-muted p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                  IMEI
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="Optional hardware IMEI"
                  value={imei}
                  onChange={(event) => setImei(event.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound size={16} />
                {isCreating ? 'Provisioning...' : 'Create Device'}
              </button>

              {createError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {createError}
                </p>
              ) : null}

              {lastProvisionedSecret ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
                    One-time Secret
                  </p>
                  <p className="mt-3 break-all rounded-2xl bg-white px-4 py-3 font-mono text-sm text-amber-900">
                    {lastProvisionedSecret}
                  </p>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-line px-4 py-8 text-sm text-ink-soft">
              Device provisioning actions are hidden for your role.
            </div>
          )}
        </article>
      </section>
    </PageShell>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: 'info' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success-soft text-emerald-700'
      : tone === 'warning'
        ? 'bg-warning-soft text-amber-700'
        : 'bg-accent-soft text-accent';

  return (
    <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
            {title}
          </p>
          <p className="mt-4 font-display text-4xl font-semibold text-ink">{value}</p>
        </div>
        <span className={`rounded-2xl p-3 ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-soft">{hint}</p>
    </article>
  );
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}
