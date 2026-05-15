'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Cpu, KeyRound, Link2, Radio, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { canProvisionDevices } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { Bike as FleetBike, Device, PaginatedResponse } from '@/lib/types/dashboard';
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
  const [assignDeviceId, setAssignDeviceId] = useState<string | null>(null);
  const [assignBikeId, setAssignBikeId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const devicesQuery = useQuery({
    queryKey: ['devices', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Device>>(
        `/devices${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
  });

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'all-for-assign'],
    queryFn: () => apiFetch<PaginatedResponse<FleetBike>>('/bikes?page=1&pageSize=200'),
  });

  const handleAssignBike = async () => {
    if (!assignDeviceId || !assignBikeId) return;
    setAssignError(null);
    setIsAssigning(true);
    try {
      await apiFetch(`/devices/${assignDeviceId}/assign-bike`, {
        method: 'POST',
        body: JSON.stringify({ bikeId: assignBikeId }),
      });
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      setAssignDeviceId(null);
      setAssignBikeId('');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setAssignError(error.message);
      } else {
        setAssignError('Failed to assign device to bike');
      }
    } finally {
      setIsAssigning(false);
    }
  };

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
            <p className="mt-1 text-xs leading-5 text-ink-soft">
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
                : 'inline-flex rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft'
            }
          >
            {device.status}
          </span>
        ),
      },
      {
        header: 'Bike',
        render: (device) => <span className="text-sm text-ink-soft">{device.bike?.label ?? 'Unassigned'}</span>,
      },
      {
        header: 'Last seen',
        render: (device) => (
          <span className="text-sm text-ink-soft">
            {device.lastSeenAt ? formatTimestamp(device.lastSeenAt) : 'Never'}
          </span>
        ),
      },
      ...(canProvision ? [{
        header: 'Actions',
        render: (device: Device) => (
          <button
            type="button"
            onClick={() => { setAssignDeviceId(device.id); setAssignBikeId(device.bikeId ?? ''); setAssignError(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent transition hover:bg-accent/20"
          >
            <Bike size={12} />
            {device.bikeId ? 'Reassign' : 'Assign'}
          </button>
        ),
      }] as Array<DataTableColumn<Device>>: []),
    ],
    [canProvision],
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
                <div className="rounded-[20px] border border-warning-ink/20 bg-warning-soft px-4 py-4">
                  <p className="text-sm font-semibold text-warning-ink">One-time device secret</p>
                  <p className="mt-2 break-all font-mono text-sm text-ink">
                    {lastProvisionedSecret}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-warning-ink/80">
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

      {/* Assign Device to Bike Modal */}
      {assignDeviceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setAssignDeviceId(null)}>
          <div className="relative mx-4 w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setAssignDeviceId(null)} className="absolute right-4 top-4 rounded-lg p-1 text-ink-muted hover:text-ink transition">
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-ink">Assign Device to Bike</h2>
            <p className="mt-1 text-sm text-ink-muted">Link this tracker unit to a bike in your fleet.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Select Bike</label>
                <select
                  value={assignBikeId}
                  onChange={(e) => setAssignBikeId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent cursor-pointer"
                >
                  <option value="">— Select a bike —</option>
                  {(bikesQuery.data?.data ?? []).map((bike) => (
                    <option key={bike.id} value={bike.id}>{bike.label}{bike.plate ? ` (${bike.plate})` : ''}</option>
                  ))}
                </select>
              </div>
              {assignError && <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{assignError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAssignDeviceId(null)} className="flex-1 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover">
                  Cancel
                </button>
                <button type="button" onClick={handleAssignBike} disabled={isAssigning || !assignBikeId} className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60">
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
