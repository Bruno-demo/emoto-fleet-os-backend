'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, Filter, ShieldAlert, Lock, MapPin, ArrowRight, ChevronDown, Check } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';

import { SelectField, TextField } from '@/components/ui/form-controls';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { Bike, FleetEvent, PaginatedResponse } from '@/lib/types/dashboard';
import { formatEnumLabel, formatTimestamp } from '@/lib/ui';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { getSubscriptionEntitlements } from '@/lib/subscription';

const EventMap = dynamic(
  () => import('@/components/events/event-map').then((mod) => mod.EventMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 w-full flex items-center justify-center rounded-2xl border border-line bg-surface-muted text-sm text-ink-soft animate-pulse">
        Loading map...
      </div>
    ),
  },
);

const PAGE_SIZE = 20;

export default function EventsPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const entitlements = useMemo(() => getSubscriptionEntitlements(user), [user]);
  const [selectedEvent, setSelectedEvent] = useState<FleetEvent | null>(null);

  const [page, setPage] = useState(1);
  const [accumulatedEvents, setAccumulatedEvents] = useState<FleetEvent[]>([]);
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [bikeId, setBikeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Reset page and accumulated list when filters change
  useEffect(() => {
    setPage(1);
    setAccumulatedEvents([]);
  }, [type, severity, bikeId, from, to]);

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

  useEffect(() => {
    if (eventsQuery.data?.data) {
      if (page === 1) {
        setAccumulatedEvents(eventsQuery.data.data);
      } else {
        setAccumulatedEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEvents = (eventsQuery.data?.data ?? []).filter((e) => !existingIds.has(e.id));
          return [...prev, ...newEvents];
        });
      }
    }
  }, [eventsQuery.data, page]);

  const bikeLabelById = useMemo(() => {
    const bikeMap = new Map<string, string>();
    for (const bike of bikesQuery.data?.data ?? []) {
      bikeMap.set(bike.id, bike.label);
    }
    return bikeMap;
  }, [bikesQuery.data?.data]);

  const currentEvents = accumulatedEvents;
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
        header: t('Timestamp'),
        render: (event) => (
          <div>
            <p className="font-semibold text-ink">{formatTimestamp(event.ts)}</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{event.id.slice(0, 8)}...</p>
          </div>
        ),
      },
      {
        header: t('Event'),
        render: (event) => (
          <div>
            <p className="font-semibold text-ink">{t(formatEnumLabel(event.type))}</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              {event.bikeId
                ? bikeLabelById.get(event.bikeId) ?? event.bikeId.slice(0, 8)
                : t('Fleet-level event')}
            </p>
          </div>
        ),
      },
      {
        header: t('Severity'),
        render: (event) => <SeverityBadge severity={event.severity} />,
      },
      {
        header: t('Actions'),
        className: 'text-right',
        cellClassName: 'text-right',
        render: (event) => (
          <div className="flex justify-end gap-2">
            {event.bikeId ? (
              <>
                <Link
                  href={`/bikes?bikeId=${event.bikeId}`}
                  className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-xs font-semibold text-accent transition hover:bg-surface-muted whitespace-nowrap"
                >
                  {t('Open bike')}
                </Link>
                <Link
                  href={`/live?bikeId=${event.bikeId}`}
                  className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-muted whitespace-nowrap"
                >
                  {t('View live')}
                </Link>
              </>
            ) : (
              <span className="text-xs font-medium text-ink-muted">{t('No linked bike')}</span>
            )}
          </div>
        ),
      },
    ],
    [bikeLabelById, t],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t('Events')}
          value={String(summary.total)}
          hint={t('Total events returned for the current backend filter set.')}
          icon={<Activity size={18} />}
          tone="info"
        />
        <MetricCard
          title={t('Critical')}
          value={String(summary.critical)}
          hint={t('Critical events visible in the current result page.')}
          icon={<ShieldAlert size={18} />}
          tone="danger"
        />
        <MetricCard
          title={t('High Severity')}
          value={String(summary.high)}
          hint={t('High severity events currently loaded into the table.')}
          icon={<Filter size={18} />}
          tone="warning"
        />
        <MetricCard
          title={t('Bike Linked')}
          value={String(summary.bikeLinked)}
          hint={t('Events that can jump directly to a bike detail or live map.')}
          icon={<CalendarDays size={18} />}
          tone="success"
        />
      </section>

      <DashboardCard
        eyebrow={t('Filter Console')}
        title={t('Event search')}
        description={t('Use filters that mirror the backend query options, then jump directly into bike or live-map context.')}
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
              className="rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-muted"
            >
              {t('Reset filters')}
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectField label={t('Event type')} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
              <option value="">{t('All event types')}</option>
              <option value="OVERSPEED">{t('Overspeed')}</option>
              <option value="SPEED_LIMIT_VIOLATION">{t('Speed limit violation')}</option>
              <option value="SCHOOL_ZONE_SPEED">{t('School zone speed')}</option>
              <option value="HOSPITAL_ZONE_SPEED">{t('Hospital zone speed')}</option>
              <option value="MARKET_ZONE_SPEED">{t('Market zone speed')}</option>
              <option value="HARSH_BRAKE">{t('Harsh brake')}</option>
              <option value="HARSH_ACCEL">{t('Harsh accel')}</option>
              <option value="HARSH_CORNER">{t('Harsh corner')}</option>
              <option value="CRASH">{t('Crash')}</option>
              <option value="THEFT_SUSPECTED">{t('Theft suspected')}</option>
              <option value="SOS">{t('SOS')}</option>
            </SelectField>

            <SelectField label={t('Severity')} value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }}>
              <option value="">{t('All severities')}</option>
              <option value="LOW">{t('Low')}</option>
              <option value="MEDIUM">{t('Medium')}</option>
              <option value="HIGH">{t('High')}</option>
              <option value="CRITICAL">{t('Critical')}</option>
            </SelectField>

            <SelectField label={t('Bike')} value={bikeId} onChange={(event) => { setBikeId(event.target.value); setPage(1); }}>
              <option value="">{t('All bikes')}</option>
              {(bikesQuery.data?.data ?? []).map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {bike.label}
                </option>
              ))}
            </SelectField>

            <TextField
              label={t('From')}
              type="datetime-local"
              value={from}
              onChange={(event) => { setFrom(event.target.value); setPage(1); }}
            />

            <TextField
              label={t('To')}
              type="datetime-local"
              value={to}
              onChange={(event) => { setTo(event.target.value); setPage(1); }}
            />

            <div className="rounded-[var(--radius-panel)] border border-line bg-surface-muted px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {t('Result scope')}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">
                {eventsQuery.data?.total ?? 0}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {t('Total events matched by the current query.')}
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
            onRowClick={(event) => setSelectedEvent(event)}
            emptyState={
              <EmptyState
                icon={<Activity size={18} />}
                title={t('No events match this query')}
                description={t('Broaden the filters or change the time window to inspect more fleet activity.')}
              />
            }
          />
        </div>

        {accumulatedEvents.length < (eventsQuery.data?.total ?? 0) && (
          <div className="mt-6 flex justify-center border-t border-line pt-6">
            <button
              type="button"
              disabled={eventsQuery.isFetching}
              onClick={() => setPage((prev) => prev + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {eventsQuery.isFetching ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : (
                <ChevronDown size={16} className="animate-bounce" />
              )}
              {eventsQuery.isFetching ? t('Loading...') : t('Load more')}
            </button>
          </div>
        )}
        {accumulatedEvents.length >= (eventsQuery.data?.total ?? 0) && (eventsQuery.data?.total ?? 0) > 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 mt-6 pt-6 border-t border-line">
            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <Check size={14} /> {t('All {total} events loaded').replace('{total}', String(eventsQuery.data?.total ?? 0))}
            </p>
          </div>
        )}
      </DashboardCard>

      {/* Event Details Drawer */}
      <Drawer
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? `${t(formatEnumLabel(selectedEvent.type))} ${t('Event')}` : ''}
        description={selectedEvent ? `${t('Event ID')}: ${selectedEvent.id}` : ''}
      >
        {selectedEvent && (
          <div className="space-y-6">
            {/* Entitlement Check */}
            {user?.role === 'INSURER' || entitlements.isPremium ? (
              <>
                {/* Severity & Timestamp */}
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                      {t('Severity')}
                    </p>
                    <div className="mt-1">
                      <SeverityBadge severity={selectedEvent.severity} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                      {t('Occurred At')}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {formatTimestamp(selectedEvent.ts)}
                    </p>
                  </div>
                </div>

                {/* Event Explanation */}
                <div className="rounded-2xl border border-line bg-surface-muted p-4">
                  <h4 className="text-sm font-bold text-ink mb-2">{t('Event Explanation')}</h4>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    {getEventDescription(selectedEvent.type, selectedEvent.metaJson as Record<string, unknown> | null, t)}
                  </p>
                </div>

                {/* Where it happened (Map) */}
                <div>
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
                    <MapPin size={16} className="text-accent" />
                    {t('Location Coordinates')}
                  </h4>
                  {(selectedEvent.metaJson as Record<string, unknown>)?.lat && (selectedEvent.metaJson as Record<string, unknown>)?.lng ? (
                    <div className="space-y-3">
                      <EventMap
                        lat={Number((selectedEvent.metaJson as Record<string, unknown>).lat)}
                        lng={Number((selectedEvent.metaJson as Record<string, unknown>).lng)}
                      />
                      <div className="flex gap-4 text-xs text-zinc-400 bg-surface px-4 py-2.5 rounded-xl border border-line">
                        <span>
                          <strong className="text-zinc-300">{t('Lat:')}</strong>{' '}
                          {Number((selectedEvent.metaJson as Record<string, unknown>).lat).toFixed(5)}
                        </span>
                        <span>
                          <strong className="text-zinc-300">{t('Lng:')}</strong>{' '}
                          {Number((selectedEvent.metaJson as Record<string, unknown>).lng).toFixed(5)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center bg-surface-hover/30">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-500 mb-2">
                        <MapPin size={15} />
                      </span>
                      <p className="text-xs text-zinc-400">
                        {t('No location coordinates recorded for this event.')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Event Metadata Details */}
                <div>
                  <h4 className="text-sm font-bold text-ink mb-3">{t('Event Details')}</h4>
                  {renderEventMeta(selectedEvent.metaJson as Record<string, unknown> | null, t)}
                </div>

                {/* Actions */}
                {selectedEvent.bikeId && (
                  <div className="flex flex-col gap-2 pt-4 border-t border-line">
                    <Link
                      href={`/bikes?bikeId=${selectedEvent.bikeId}`}
                      onClick={() => setSelectedEvent(null)}
                      className="flex items-center justify-between rounded-xl border border-line bg-surface-hover px-4 py-3 text-sm font-semibold text-accent transition hover:bg-surface-muted"
                    >
                      <span>{t('Go to bike profile')}</span>
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href={`/live?bikeId=${selectedEvent.bikeId}`}
                      onClick={() => setSelectedEvent(null)}
                      className="flex items-center justify-between rounded-xl border border-line bg-surface-hover px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted"
                    >
                      <span>{t('Locate bike on live map')}</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                )}
              </>
            ) : (
              /* Upgrade Lock Screen */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent mb-4 animate-pulse">
                  <Lock size={24} />
                </span>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('Event Diagnostics Locked')}
                </h3>
                <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
                  {t(
                    'Detailed event explanations, exact GPS coordinates, and historical location mapping are premium features. Upgrade to Operations Plus to unlock.',
                  )}
                </p>
                <Link
                  href="/checkout?plan=operations-plus"
                  onClick={() => setSelectedEvent(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-strong active:scale-95"
                >
                  {t('Upgrade plan')}
                </Link>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function getEventDescription(type: string, meta: Record<string, unknown> | null | undefined, t: (key: string) => string): string {
  switch (type) {
    case 'OVERSPEED':
      return t('The vehicle exceeded the speed limit of {limit} kph within the slow zone "{zone}" by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? 'N/A'))
        .replace('{zone}', String(meta?.zoneName ?? t('Unknown Zone')))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'SPEED_LIMIT_VIOLATION':
      return t('The vehicle exceeded the road speed limit of {limit} kph by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? 'N/A'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'SCHOOL_ZONE_SPEED':
      return t('The vehicle exceeded the safety speed limit of {limit} kph inside a school zone by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? '30'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'HOSPITAL_ZONE_SPEED':
      return t('The vehicle exceeded the safety speed limit of {limit} kph inside a hospital zone by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? '30'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'MARKET_ZONE_SPEED':
      return t('The vehicle exceeded the safety speed limit of {limit} kph inside a market zone by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? '25'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'HARSH_BRAKE':
      return t('Harsh braking detected. G-force of {gforce} G recorded during a sudden speed drop of {delta} kph.')
        .replace('{gforce}', String(meta?.gpsGForce ?? meta?.accelX ?? 'N/A'))
        .replace('{delta}', String(meta?.speedDeltaKph ?? 'N/A'));
    case 'HARSH_ACCEL':
      return t('Harsh acceleration detected. G-force of {gforce} G recorded during a sudden speed increase of {delta} kph.')
        .replace('{gforce}', String(meta?.gpsGForce ?? meta?.accelX ?? 'N/A'))
        .replace('{delta}', String(meta?.speedDeltaKph ?? 'N/A'));
    case 'HARSH_CORNER':
      return t('Harsh cornering detected. Sudden lateral G-force of {gforce} G recorded.')
        .replace('{gforce}', String(meta?.gpsGForce ?? 'N/A'));
    case 'CRASH':
      return t('Severe crash alert! The vehicle experienced an impact G-force of {gforce} G with a speed drop of {delta} kph.')
        .replace('{gforce}', String(meta?.gForce ? Number(meta.gForce).toFixed(2) : 'N/A'))
        .replace('{delta}', String(meta?.speedDropKph ? Number(meta.speedDropKph).toFixed(2) : 'N/A'));
    case 'THEFT_SUSPECTED':
      return t('Suspicious movement alert: {reason} with a speed of {speed} kph.')
        .replace('{reason}', meta?.reason === 'movement_while_ignition_off' ? t('movement with ignition off') : t('outside park zone at night'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'SOS':
      return t('Rider triggered the physical SOS button on the vehicle, indicating an emergency.');
    case 'TRACKER_OFFLINE':
      return t('Tracker offline alert! The device has not sent any data since {lastSeen}.')
        .replace('{lastSeen}', meta?.lastSeenAt ? formatTimestamp(String(meta.lastSeenAt)) : t('Never'));
    default:
      return t('An unexpected fleet telemetry event was recorded.');
  }
}

function SeverityBadge({ severity }: { severity: FleetEvent['severity'] }) {
  const { t } = useTranslation();
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
      {t(severity)}
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

function renderEventMeta(meta: Record<string, unknown> | null | undefined, t: (key: string) => string) {
  if (!meta || Object.keys(meta).length === 0) {
    return <p className="text-xs text-zinc-500">{t('No additional metadata recorded.')}</p>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyLabels: Record<string, { label: string; format: (val: any) => string }> = {
    speedLimitKph: { label: t('Speed Limit'), format: (val) => `${val} KM/H` },
    speedKph: { label: t('Current Speed'), format: (val) => `${val} KM/H` },
    zoneName: { label: t('Zone Name'), format: (val) => String(val) },
    gpsGForce: { label: t('Impact Force'), format: (val) => `${val} G` },
    gForce: { label: t('Impact Force'), format: (val) => `${Number(val).toFixed(2)} G` },
    accelX: { label: t('Acceleration G-Force'), format: (val) => `${val} G` },
    speedDeltaKph: { label: t('Speed Difference'), format: (val) => `${val} KM/H` },
    speedDropKph: { label: t('Speed Deceleration'), format: (val) => `${Number(val).toFixed(2)} KM/H` },
    reason: { 
      label: t('Trigger Reason'), 
      format: (val) => val === 'movement_while_ignition_off' ? t('Movement while ignition is OFF') : String(val) 
    },
    batteryPct: { label: t('Battery Level'), format: (val) => `${val}%` },
    ignition: { label: t('Ignition Status'), format: (val) => val ? t('ON') : t('OFF') },
    lastSeenAt: { label: t('Last Active'), format: (val) => new Date(val).toLocaleString() },
  };

  const items = Object.entries(meta).map(([key, val]) => {
    if (key === 'lat' || key === 'lng') return null;

    const spec = keyLabels[key];
    const displayLabel = spec ? spec.label : formatEnumLabel(key);
    const displayValue = spec ? spec.format(val) : String(val);

    return (
      <div key={key} className="flex justify-between items-center py-2 border-b border-line/40 last:border-0 text-xs">
        <span className="text-ink-muted font-semibold">{displayLabel}</span>
        <span className="text-ink font-medium bg-surface px-2.5 py-1 rounded-lg border border-line">{displayValue}</span>
      </div>
    );
  }).filter(Boolean);

  if (items.length === 0) {
    return <p className="text-xs text-zinc-500">{t('No metadata to display.')}</p>;
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-muted/40 p-4 space-y-1">
      {items}
    </div>
  );
}

