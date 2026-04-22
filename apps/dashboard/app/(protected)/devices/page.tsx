'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, KeyRound, Link2, Radio, ShieldCheck, Smartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { canProvisionDevices } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { Device, PaginatedResponse } from '@/lib/types/dashboard';
import { formatTimestamp } from '@/lib/ui';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice, TextField } from '@/components/ui/form-controls';
import { PaginationControls } from '@/components/ui/pagination-controls';

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

  const columns = useMemo<Array<DataTableColumn<Device>>>(
    () => [
      {
        header: 'Device',
        render: (device) => (
          <div>
            <p className="font-semibold text-ink">{device.deviceUid}</p>
            <p className="mt-1 text-xs leading-5 text-white/60">
              {device.imei ?? device.id.slice(0, 8)}
            </p>
          </div>
        ),
      },
      {
        header: 'Status',
        render: (device) => (
          <span
            className={
              device.status === 'ACTIVE'
                ? 'inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
                : 'inline-flex rounded-full bg-white/[0.02] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60'
            }
          >
            {device.status}
          </span>
        ),
      },
      {
        header: 'Bike',
        render: (device) => <span className="text-sm text-white/60">{device.bike?.label ?? 'Unassigned'}</span>,
      },
      {
        header: 'Last seen',
        render: (device) => (
          <span className="text-sm text-white/60">
            {device.lastSeenAt ? formatTimestamp(device.lastSeenAt) : 'Never'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
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
        <DashboardCard eyebrow="Device Registry" title="Provisioned hardware" description="Review assignment health and last-seen activity without leaving the dashboard.">
          <DataTable
            data={devicesQuery.data?.data ?? []}
            columns={columns}
            keyExtractor={(device) => device.id}
            loading={devicesQuery.isLoading}
            emptyState={
              <EmptyState
                icon={<Smartphone size={18} />}
                title="No devices provisioned yet"
                description="Provision a device to begin telemetry ingest for a bike."
              />
            }
          />

          <PaginationControls
            page={devicesQuery.data?.page ?? page}
            totalPages={devicesQuery.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </DashboardCard>

        <DashboardCard eyebrow="Provisioning" title="Create a device identity" description="Provisioning returns a one-time device secret. Store it securely during technician handoff.">
          {canProvision ? (
            <form className="space-y-4" onSubmit={createDevice}>
              <TextField
                label="Device UID"
                placeholder="EMOTO-DEV-001"
                value={deviceUid}
                onChange={(event) => setDeviceUid(event.target.value)}
              />
              <TextField
                label="IMEI"
                placeholder="Optional hardware IMEI"
                value={imei}
                onChange={(event) => setImei(event.target.value)}
              />

              {createError ? <InlineNotice message={createError} /> : null}

              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound size={16} />
                {isCreating ? 'Provisioning device...' : 'Provision device'}
              </button>

              {lastProvisionedSecret ? (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-amber-800">One-time device secret</p>
                  <p className="mt-2 break-all font-mono text-sm text-amber-900">
                    {lastProvisionedSecret}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-amber-700">
                    This value is shown only once. Copy it into the technician handoff flow now.
                  </p>
                </div>
              ) : null}
            </form>
          ) : (
            <EmptyState
              icon={<KeyRound size={18} />}
              title="Provisioning requires elevated access"
              description="Use an OWNER, ADMIN, or TECH account to create or rotate device identities."
            />
          )}
        </DashboardCard>
      </section>
    </div>
  );
}
