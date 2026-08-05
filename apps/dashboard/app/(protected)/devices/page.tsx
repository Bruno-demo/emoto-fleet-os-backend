'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useQuery } from '@tanstack/react-query';
import { Cpu, Radio, ShieldCheck, Smartphone, Link2, ChevronDown, Check } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { Device, PaginatedResponse } from '@/lib/types/dashboard';
import { formatTimestamp } from '@/lib/ui';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

import { useTranslation } from '@/components/i18n/LanguageProvider';
import { SubscriptionGate } from '@/components/subscription-gate';
import { canUseFeature } from '@/lib/subscription';
import { useCurrentUser } from '@/lib/auth/use-current-user';

const PAGE_SIZE = 20;

export default function DevicesPage() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const canUseDevices = canUseFeature(currentUser, 'devices');
  const [page, setPage] = useState(1);
  const [accumulatedDevices, setAccumulatedDevices] = useState<Device[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const devicesQuery = useQuery({
    queryKey: ['devices', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Device>>(
        `/devices${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
    enabled: canUseDevices,
  });

  useEffect(() => {
    if (devicesQuery.data?.data) {
      if (page === 1) {
        setAccumulatedDevices(devicesQuery.data.data);
      } else {
        setAccumulatedDevices((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const newDevices = (devicesQuery.data?.data ?? []).filter((d) => !existingIds.has(d.id));
          return [...prev, ...newDevices];
        });
      }
    }
  }, [devicesQuery.data, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, [devicesQuery.data?.data]);

  const deviceStats = useMemo(() => {
    const devices = accumulatedDevices;
    const recentCutoff = currentTime - 10 * 60 * 1000;
    return {
      total: devicesQuery.data?.total ?? 0,
      active: devices.filter((device) => device.status === 'ACTIVE').length,
      assigned: devices.filter((device) => !!device.bikeId).length,
      recentlySeen: devices.filter((device) => {
        if (!device.lastSeenAt || currentTime === 0) {
          return false;
        }
        return Date.parse(device.lastSeenAt) >= recentCutoff;
      }).length,
    };
  }, [devicesQuery.data?.data, devicesQuery.data?.total, currentTime]);

  const columns = useMemo<Array<DataTableColumn<Device>>>(
    () => [
      {
        header: t('Device'),
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
        header: t('Status'),
        render: (device) => (
          <span
            className={
              device.status === 'ACTIVE'
                ? 'inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink whitespace-nowrap'
                : 'inline-flex rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft whitespace-nowrap'
            }
          >
            {t(device.status)}
          </span>
        ),
      },
      {
        header: t('SIM Phone (SMS Fallback)'),
        render: (device) => (
          <span className="text-xs font-mono text-ink-soft">
            {device.simPhoneNumber ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2 py-1 text-sky-400 font-semibold">
                📱 {device.simPhoneNumber}
              </span>
            ) : (
              <span className="text-ink-soft/60 italic">{t('No SIM set')}</span>
            )}
          </span>
        ),
      },
      {
        header: t('Bike'),
        render: (device) => <span className="text-sm text-ink-soft">{device.bike?.label ?? t('Unassigned')}</span>,
      },
      {
        header: t('Last seen'),
        render: (device) => (
          <span className="text-sm text-ink-soft">
            {device.lastSeenAt ? formatTimestamp(device.lastSeenAt) : t('Never')}
          </span>
        ),
      },
    ],
    [t],
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deviceUidInput, setDeviceUidInput] = useState('');
  const [imeiInput, setImeiInput] = useState('');
  const [fwVersionInput, setFwVersionInput] = useState('');
  const [simPhoneInput, setSimPhoneInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceUidInput.trim()) {
      setFormError(t('Device ID (UID) is required.'));
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiFetch('/devices', {
        method: 'POST',
        body: JSON.stringify({
          deviceUid: deviceUidInput.trim(),
          imei: imeiInput.trim() || undefined,
          fwVersion: fwVersionInput.trim() || undefined,
          simPhoneNumber: simPhoneInput.trim() || undefined,
        }),
      });
      setIsAddModalOpen(false);
      setDeviceUidInput('');
      setImeiInput('');
      setFwVersionInput('');
      setSimPhoneInput('');
      setPage(1);
      devicesQuery.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SubscriptionGate>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">{t('Devices')}</h1>
            <p className="text-sm text-ink-soft">{t('Manage GPS tracking devices and assignments')}</p>
          </div>
          {(currentUser?.fleetName === 'E-Moto HQ' || currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER') && currentUser?.fleetName === 'E-Moto HQ' && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast shadow-sm transition hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98]"
            >
              <Cpu size={16} />
              {t('+ Add Device')}
            </button>
          )}
        </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t('Registered Devices')}
          value={String(deviceStats.total)}
          hint={t('Total devices visible in the current fleet.')}
          icon={<Cpu size={18} />}
          tone="info"
        />
        <MetricCard
          title={t('Active')}
          value={String(deviceStats.active)}
          hint={t('Devices marked active and eligible for telemetry ingest.')}
          icon={<ShieldCheck size={18} />}
          tone="success"
        />
        <MetricCard
          title={t('Assigned')}
          value={String(deviceStats.assigned)}
          hint={t('Devices currently attached to a bike record.')}
          icon={<Link2 size={18} />}
          tone="info"
        />
        <MetricCard
          title={t('Seen < 10 Min')}
          value={String(deviceStats.recentlySeen)}
          hint={t('Devices with a fresh heartbeat in the recent window.')}
          icon={<Radio size={18} />}
          tone="warning"
        />
      </section>

      <section className="w-full">
        <DashboardCard eyebrow={t('Device Registry')} title={t('Provisioned hardware')} description={t('Review assignment health and last-seen activity without leaving the dashboard.')}>
          <DataTable
            data={accumulatedDevices}
            columns={columns}
            keyExtractor={(device) => device.id}
            loading={devicesQuery.isLoading}
            emptyState={
              <EmptyState
                icon={<Smartphone size={18} />}
                title={t('No devices provisioned yet')}
                description={t('No devices found in the current fleet registry.')}
              />
            }
          />

          {accumulatedDevices.length < (devicesQuery.data?.total ?? 0) && (
            <div className="mt-6 flex justify-center border-t border-line pt-6">
              <button
                type="button"
                disabled={devicesQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {devicesQuery.isFetching ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : (
                  <ChevronDown size={16} className="animate-bounce" />
                )}
                {devicesQuery.isFetching ? t('Loading...') : t('Load more')}
              </button>
            </div>
          )}
          {accumulatedDevices.length >= (devicesQuery.data?.total ?? 0) && (devicesQuery.data?.total ?? 0) > 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 mt-6 pt-6 border-t border-line">
              <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                <Check size={14} /> {t('All {total} devices loaded').replace('{total}', String(devicesQuery.data?.total ?? 0))}
              </p>
            </div>
          )}
        </DashboardCard>
      </section>

      {/* Add Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2 text-ink">
                <Cpu className="text-accent" size={20} />
                <h2 className="text-lg font-bold">{t('Register New Device')}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
                {formError}
              </div>
            )}

            <form onSubmit={handleRegisterDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
                  {t('Device ID / UID')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DEV-10001 or ST-901-01"
                  value={deviceUidInput}
                  onChange={(e) => setDeviceUidInput(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
                <p className="mt-1 text-[11px] text-ink-soft">{t('Unique hardware identifier or internal device tag.')}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
                  {t('IMEI Number')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 864012345678901"
                  value={imeiInput}
                  onChange={(e) => setImeiInput(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
                <p className="mt-1 text-[11px] text-ink-soft">{t('15-digit SinoTrack hardware IMEI for GPRS matching.')}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
                  {t('Tracker SIM Phone (SMS Fallback)')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0781234567 or +250781234567"
                  value={simPhoneInput}
                  onChange={(e) => setSimPhoneInput(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
                <p className="mt-1 text-[11px] text-ink-soft">{t('Used for budget-friendly SMS lock/unlock commands when GPRS/TCP is offline.')}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
                  {t('Firmware Version')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. v1.0.0 (optional)"
                  value={fwVersionInput}
                  onChange={(e) => setFwVersionInput(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-line pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-hover"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-contrast border-t-transparent" />
                  ) : null}
                  {isSubmitting ? t('Registering...') : t('Save Device')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </SubscriptionGate>
  );
}

