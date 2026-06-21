'use client';

import { useQuery } from '@tanstack/react-query';
import { Cpu, Radio, ShieldCheck, Smartphone, Link2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { Device, PaginatedResponse } from '@/lib/types/dashboard';
import { formatTimestamp } from '@/lib/ui';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useTranslation } from '@/components/i18n/LanguageProvider';

const PAGE_SIZE = 20;

export default function DevicesPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const devicesQuery = useQuery({
    queryKey: ['devices', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Device>>(
        `/devices${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, [devicesQuery.data?.data]);

  const deviceStats = useMemo(() => {
    const devices = devicesQuery.data?.data ?? [];
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
            data={devicesQuery.data?.data ?? []}
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

          <PaginationControls
            page={devicesQuery.data?.page ?? page}
            totalPages={devicesQuery.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </DashboardCard>
      </section>
    </div>
  );
}

