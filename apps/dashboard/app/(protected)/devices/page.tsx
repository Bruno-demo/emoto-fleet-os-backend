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

  return (
    <SubscriptionGate>
      <div className="space-y-6">
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
    </div>
    </SubscriptionGate>
  );
}

