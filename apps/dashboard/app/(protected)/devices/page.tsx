'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

  // Creates one device and displays one-time secret only for provisioning roles.
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
      const response = await apiFetch<{ device: Device; deviceSecret: string }>(
        '/devices',
        {
          method: 'POST',
          body: JSON.stringify({
            deviceUid: deviceUid.trim(),
            imei: imei.trim() || undefined,
          }),
        },
      );

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
      description="Device inventory and provisioning controls based on role permissions."
    >
      {canProvision ? (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">Provision Device</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={createDevice}>
            <input
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
              placeholder="deviceUid"
              value={deviceUid}
              onChange={(event) => setDeviceUid(event.target.value)}
            />
            <input
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
              placeholder="imei (optional)"
              value={imei}
              onChange={(event) => setImei(event.target.value)}
            />
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isCreating ? 'Provisioning...' : 'Create Device'}
            </button>
          </form>

          {createError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {createError}
            </p>
          ) : null}

          {lastProvisionedSecret ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              One-time secret: <span className="font-mono">{lastProvisionedSecret}</span>
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-ink-soft">
            Device provisioning actions are hidden for your role.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                <th className="px-2 py-2">Device UID</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Bike</th>
                <th className="px-2 py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {(devicesQuery.data?.data ?? []).map((device) => (
                <tr key={device.id} className="border-t border-line">
                  <td className="px-2 py-2 text-ink">{device.deviceUid}</td>
                  <td className="px-2 py-2">
                    <StatusPill
                      label={device.status}
                      tone={device.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="px-2 py-2 text-ink-soft">
                    {device.bike?.label ?? 'Unassigned'}
                  </td>
                  <td className="px-2 py-2 text-ink-soft">
                    {device.lastSeenAt
                      ? new Date(device.lastSeenAt).toLocaleString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={devicesQuery.data?.page ?? page}
          totalPages={devicesQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </section>
    </PageShell>
  );
}
