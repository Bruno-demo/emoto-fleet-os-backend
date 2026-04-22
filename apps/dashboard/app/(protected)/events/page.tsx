'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, Filter, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SelectField, TextField } from '@/components/ui/form-controls';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { Bike, FleetEvent, PaginatedResponse } from '@/lib/types/dashboard';
import { formatEnumLabel, formatTimestamp } from '@/lib/ui';

const PAGE_SIZE = 20;

export default function EventsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [bikeId, setBikeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'event-filter'],
    queryFn: () => apiFetch<PaginatedResponse<Bike>>('/bikes?page=1&pageSize=100'),
  });

  const eventsQuery = useQuery({
    queryKey: ['events', page, type, severity, bikeId, from, to],
    queryFn: () =>
      apiFetch<PaginatedResponse<FleetEvent>>(
        `/events${buildQueryString({
          page,
          pageSize: PAGE_SIZE,
          type: type || undefined,
          severity: severity || undefined,
          bikeId: bikeId || undefined,
          from: toIsoUtcOrUndefined(from),
          to: toIsoUtcOrUndefined(to),
        })}`,
      ),
  });

  const bikeLabelById = useMemo(() => {
    const bikeMap = new Map<string, string>();
    for (const bike of bikesQuery.data?.data ?? []) {
      bikeMap.set(bike.id, bike.label);
    }
    return bikeMap;
  }, [bikesQuery.data?.data]);

  const currentEvents = useMemo(() => eventsQuery.data?.data ?? [], [eventsQuery.data?.data]);
  const summary = useMemo(() => {
    return {
      total: eventsQuery.data?.total ?? 0,
      critical: currentEvents.filter((event) => event.severity === 'CRITICAL').length,
      high: currentEvents.filter((event) => event.severity === 'HIGH').length,
      bikeLinked: currentEvents.filter((event) => !!event.bikeId).length,
    };
  }, [currentEvents, eventsQuery.data?.total]);

  const columns = useMemo<Array<DataTableColumn<FleetEvent>>>(
    () => [
      {
        header: 'Timestamp',
        render: (event) => (
          <div>
            <p className="font-semibold text-ink">{formatTimestamp(event.ts)}</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{event.id.slice(0, 8)}...</p>
          </div>
        ),
      },
      {
        header: 'Event',
        render: (event) => (
          <div>
            <p className="font-semibold text-ink">{formatEnumLabel(event.type)}</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              {event.bikeId
                ? bikeLabelById.get(event.bikeId) ?? event.bikeId.slice(0, 8)
                : 'Fleet-level event'}
            </p>
          </div>
        ),
      },
      {
        header: 'Severity',
        render: (event) => <SeverityBadge severity={event.severity} />,
      },
      {
        header: 'Actions',
        className: 'text-right',
        cellClassName: 'text-right',
        render: (event) => (
          <div className="flex justify-end gap-2">
            {event.bikeId ? (
              <>
                <Link
                  href={`/bikes?bikeId=${event.bikeId}`}
                  className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-xs font-semibold text-accent transition hover:bg-white/[0.08]"
                >
                  Open bike
                </Link>
                <Link
                  href={`/live?bikeId=${event.bikeId}`}
                  className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-xs font-semibold text-ink transition hover:bg-white/[0.08]"
                >
                  View live
                </Link>
              </>
            ) : (
              <span className="text-xs font-medium text-ink-muted">No linked bike</span>
            )}
          </div>
        ),
      },
    ],
    [bikeLabelById],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Events"
          value={String(summary.total)}
          hint="Total events returned for the current backend filter set."
          icon={<Activity size={18} />}
          tone="info"
        />
        <MetricCard
          title="Critical"
          value={String(summary.critical)}
          hint="Critical events visible in the current result page."
          icon={<ShieldAlert size={18} />}
          tone="danger"
        />
        <MetricCard
          title="High Severity"
          value={String(summary.high)}
          hint="High severity events currently loaded into the table."
          icon={<Filter size={18} />}
          tone="warning"
        />
        <MetricCard
          title="Bike Linked"
          value={String(summary.bikeLinked)}
          hint="Events that can jump directly to a bike detail or live map."
          icon={<CalendarDays size={18} />}
          tone="success"
        />
      </section>

      <DashboardCard
        eyebrow="Filter Console"
        title="Event search"
        description="Use filters that mirror the backend query options, then jump directly into bike or live-map context."
      >
        <DataTableToolbar
          actions={
            <button
              type="button"
              onClick={() => {
                setType('');
                setSeverity('');
                setBikeId('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
              className="rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/[0.08]"
            >
              Reset filters
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectField label="Event type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
              <option value="">All event types</option>
              <option value="OVERSPEED">Overspeed</option>
              <option value="SPEED_LIMIT_VIOLATION">Speed limit violation</option>
              <option value="SCHOOL_ZONE_SPEED">School zone speed</option>
              <option value="HOSPITAL_ZONE_SPEED">Hospital zone speed</option>
              <option value="MARKET_ZONE_SPEED">Market zone speed</option>
              <option value="HARSH_BRAKE">Harsh brake</option>
              <option value="HARSH_ACCEL">Harsh accel</option>
              <option value="HARSH_CORNER">Harsh corner</option>
              <option value="CRASH">Crash</option>
              <option value="THEFT_SUSPECTED">Theft suspected</option>
              <option value="SOS">SOS</option>
            </SelectField>

            <SelectField label="Severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }}>
              <option value="">All severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </SelectField>

            <SelectField label="Bike" value={bikeId} onChange={(event) => { setBikeId(event.target.value); setPage(1); }}>
              <option value="">All bikes</option>
              {(bikesQuery.data?.data ?? []).map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {bike.label}
                </option>
              ))}
            </SelectField>

            <TextField
              label="From"
              type="datetime-local"
              value={from}
              onChange={(event) => { setFrom(event.target.value); setPage(1); }}
            />

            <TextField
              label="To"
              type="datetime-local"
              value={to}
              onChange={(event) => { setTo(event.target.value); setPage(1); }}
            />

            <div className="rounded-[var(--radius-panel)] border border-line bg-surface-muted px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Result scope
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">
                {eventsQuery.data?.total ?? 0}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Total events matched by the current query.
              </p>
            </div>
          </div>
        </DataTableToolbar>

        <div className="mt-6">
          <DataTable
            data={currentEvents}
            columns={columns}
            keyExtractor={(event) => event.id}
            loading={eventsQuery.isLoading}
            emptyState={
              <EmptyState
                icon={<Activity size={18} />}
                title="No events match this query"
                description="Broaden the filters or change the time window to inspect more fleet activity."
              />
            }
          />
        </div>

        <PaginationControls
          page={eventsQuery.data?.page ?? page}
          totalPages={eventsQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </DashboardCard>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: FleetEvent['severity'] }) {
  const className =
    severity === 'CRITICAL'
      ? 'bg-critical-soft text-critical-ink'
      : severity === 'HIGH'
        ? 'bg-warning-soft text-warning-ink'
        : severity === 'MEDIUM'
          ? 'bg-accent-soft text-accent'
          : 'bg-low-soft text-low-ink';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${className}`}>
      {severity}
    </span>
  );
}

// Converts browser datetime-local values into UTC strings expected by the backend filters.
function toIsoUtcOrUndefined(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate.toISOString();
}
