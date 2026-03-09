'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, Filter, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { StatusPill } from '@/components/ui/status-pill';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type {
  Bike,
  FleetEvent,
  PaginatedResponse,
} from '@/lib/types/dashboard';

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

  const summary = useMemo(() => {
    const currentEvents = eventsQuery.data?.data ?? [];
    return {
      total: eventsQuery.data?.total ?? 0,
      critical: currentEvents.filter((event) => event.severity === 'CRITICAL').length,
      high: currentEvents.filter((event) => event.severity === 'HIGH').length,
      bikeLinked: currentEvents.filter((event) => !!event.bikeId).length,
    };
  }, [eventsQuery.data?.data, eventsQuery.data?.total]);

  const currentEvents = eventsQuery.data?.data ?? [];

  return (
    <PageShell
      title="Events"
      description="Search the fleet event stream by severity, type, bike, and time range without losing the direct jump paths into bike and live map views."
    >
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
          hint="Events that can jump directly to a bike detail or live-map context."
          icon={<CalendarDays size={18} />}
          tone="success"
        />
      </section>

      <section className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Filter Console
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              Event search
            </h2>
          </div>

          <button
            type="button"
            className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted"
            onClick={() => {
              setType('');
              setSeverity('');
              setBikeId('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Reset Filters
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label="Event type"
            value={type}
            onChange={(value) => {
              setType(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All event types' },
              { value: 'OVERSPEED', label: 'OVERSPEED' },
              { value: 'HARSH_BRAKE', label: 'HARSH_BRAKE' },
              { value: 'HARSH_ACCEL', label: 'HARSH_ACCEL' },
              { value: 'HARSH_CORNER', label: 'HARSH_CORNER' },
              { value: 'CRASH', label: 'CRASH' },
              { value: 'THEFT_SUSPECTED', label: 'THEFT_SUSPECTED' },
              { value: 'SOS', label: 'SOS' },
            ]}
          />

          <SelectField
            label="Severity"
            value={severity}
            onChange={(value) => {
              setSeverity(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All severities' },
              { value: 'LOW', label: 'LOW' },
              { value: 'MEDIUM', label: 'MEDIUM' },
              { value: 'HIGH', label: 'HIGH' },
              { value: 'CRITICAL', label: 'CRITICAL' },
            ]}
          />

          <SelectField
            label="Bike"
            value={bikeId}
            onChange={(value) => {
              setBikeId(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All bikes' },
              ...(bikesQuery.data?.data ?? []).map((bike) => ({
                value: bike.id,
                label: bike.label,
              })),
            ]}
          />

          <InputField
            label="From"
            type="datetime-local"
            value={from}
            onChange={(value) => {
              setFrom(value);
              setPage(1);
            }}
          />

          <InputField
            label="To"
            type="datetime-local"
            value={to}
            onChange={(value) => {
              setTo(value);
              setPage(1);
            }}
          />

          <div className="rounded-3xl border border-line bg-surface-muted px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Result scope
            </p>
            <p className="mt-3 text-2xl font-display font-semibold text-ink">
              {eventsQuery.data?.total ?? 0}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Total events matched by the current query.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.16em] text-ink-soft">
                <th className="px-3 py-3">Timestamp</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Severity</th>
                <th className="px-3 py-3">Bike</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentEvents.map((event) => (
                <tr key={event.id} className="border-b border-line/70 last:border-b-0">
                  <td className="px-3 py-4 text-ink-soft">{formatTimestamp(event.ts)}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-2xl bg-surface-muted p-2 text-accent">
                        <Activity size={16} />
                      </span>
                      <div>
                        <p className="font-medium text-ink">{formatLabel(event.type)}</p>
                        <p className="mt-1 text-xs text-ink-soft">{event.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill label={event.severity} tone={eventSeverityTone(event.severity)} />
                  </td>
                  <td className="px-3 py-4 text-ink-soft">
                    {event.bikeId ? event.bikeId.slice(0, 8) : 'N/A'}
                  </td>
                  <td className="px-3 py-4">
                    {event.bikeId ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/bikes?bikeId=${event.bikeId}`}
                          className="rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-muted"
                        >
                          Bike detail
                        </Link>
                        <Link
                          href={`/live?bikeId=${event.bikeId}`}
                          className="rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-muted"
                        >
                          Show on map
                        </Link>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-soft">No bike target</span>
                    )}
                  </td>
                </tr>
              ))}
              {currentEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-ink-soft">
                    No events match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={eventsQuery.data?.page ?? page}
          totalPages={eventsQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
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
  tone: 'info' | 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success-soft text-emerald-700'
      : tone === 'warning'
        ? 'bg-warning-soft text-amber-700'
        : tone === 'danger'
          ? 'bg-danger-soft text-rose-700'
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface-muted px-4 py-4">
      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface-muted px-4 py-4">
      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
      />
    </div>
  );
}

function eventSeverityTone(severity: FleetEvent['severity']) {
  if (severity === 'CRITICAL') {
    return 'danger' as const;
  }
  if (severity === 'HIGH') {
    return 'warning' as const;
  }
  if (severity === 'MEDIUM') {
    return 'info' as const;
  }
  return 'neutral' as const;
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

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
