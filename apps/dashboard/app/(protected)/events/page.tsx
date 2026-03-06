'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
    queryFn: () =>
      apiFetch<PaginatedResponse<Bike>>('/bikes?page=1&pageSize=100'),
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

  return (
    <PageShell
      title="Events"
      description="Fleet event stream with backend-aligned filters and bike/map jump actions."
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-3">
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">All event types</option>
            <option value="OVERSPEED">OVERSPEED</option>
            <option value="HARSH_BRAKE">HARSH_BRAKE</option>
            <option value="HARSH_ACCEL">HARSH_ACCEL</option>
            <option value="HARSH_CORNER">HARSH_CORNER</option>
            <option value="CRASH">CRASH</option>
            <option value="THEFT_SUSPECTED">THEFT_SUSPECTED</option>
            <option value="SOS">SOS</option>
          </select>

          <select
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">All severities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          <select
            value={bikeId}
            onChange={(event) => {
              setBikeId(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">All bikes</option>
            {(bikesQuery.data?.data ?? []).map((bike) => (
              <option key={bike.id} value={bike.id}>
                {bike.label}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />

          <input
            type="datetime-local"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />

          <button
            type="button"
            className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-muted"
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

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                <th className="px-2 py-2">Timestamp</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Bike</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(eventsQuery.data?.data ?? []).map((event) => (
                <tr key={event.id} className="border-t border-line">
                  <td className="px-2 py-2 text-ink-soft">
                    {new Date(event.ts).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 font-medium text-ink">{event.type}</td>
                  <td className="px-2 py-2">
                    <StatusPill
                      label={event.severity}
                      tone={
                        event.severity === 'CRITICAL'
                          ? 'danger'
                          : event.severity === 'HIGH'
                            ? 'warning'
                            : 'info'
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-ink-soft">
                    {event.bikeId?.slice(0, 8) ?? 'N/A'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      {event.bikeId ? (
                        <>
                          <Link
                            href={`/bikes?bikeId=${event.bikeId}`}
                            className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-muted"
                          >
                            Bike Detail
                          </Link>
                          <Link
                            href={`/live?bikeId=${event.bikeId}`}
                            className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-muted"
                          >
                            Show on Map
                          </Link>
                        </>
                      ) : (
                        <span className="text-xs text-ink-soft">No bike target</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
