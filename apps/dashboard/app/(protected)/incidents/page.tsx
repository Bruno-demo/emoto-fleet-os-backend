'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type {
  FleetEvent,
  Incident,
  IncidentEvidencePack,
  PaginatedResponse,
} from '@/lib/types/dashboard';

const PAGE_SIZE = 20;
const STATUS_FILTERS = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'] as const;

type IncidentStatusFilter = (typeof STATUS_FILTERS)[number] | '';

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<IncidentStatusFilter>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [evidencePack, setEvidencePack] = useState<IncidentEvidencePack | null>(null);
  const [isGeneratingEvidence, setIsGeneratingEvidence] = useState(false);

  const incidentsQuery = useQuery({
    queryKey: ['incidents', page, status, from, to],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>(
        `/incidents${buildQueryString({
          page,
          pageSize: PAGE_SIZE,
          status: status || undefined,
          from: toIsoUtcOrUndefined(from),
          to: toIsoUtcOrUndefined(to),
        })}`,
      ),
  });

  const selectedIncident = useMemo(
    () =>
      (incidentsQuery.data?.data ?? []).find(
        (incident) => incident.id === selectedIncidentId,
      ) ?? null,
    [incidentsQuery.data, selectedIncidentId],
  );

  const incidentTimelineEventsQuery = useQuery({
    queryKey: ['incidents', selectedIncidentId, 'timeline-events'],
    queryFn: async () => {
      if (!selectedIncident?.bikeId) {
        return [] as FleetEvent[];
      }

      const centerTs = new Date(selectedIncident.createdAt).getTime();
      const timelineFrom = new Date(centerTs - 2 * 60 * 60 * 1000).toISOString();
      const timelineTo = new Date(centerTs + 2 * 60 * 60 * 1000).toISOString();

      const response = await apiFetch<PaginatedResponse<FleetEvent>>(
        `/events${buildQueryString({
          bikeId: selectedIncident.bikeId,
          from: timelineFrom,
          to: timelineTo,
          page: 1,
          pageSize: 30,
        })}`,
      );
      return response.data;
    },
    enabled: !!selectedIncidentId && !!selectedIncident?.bikeId,
  });

  // Applies incident status transitions through acknowledge/resolve/false-alarm APIs.
  const runIncidentAction = async (
    action: 'acknowledge' | 'resolve' | 'false-alarm',
  ) => {
    if (!selectedIncident) {
      return;
    }

    setActionError(null);
    try {
      setIsSubmittingAction(true);
      await apiFetch<Incident>(`/incidents/${selectedIncident.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || undefined }),
      });
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setNotes('');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setActionError(error.message);
      } else {
        setActionError('Unable to update incident status');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Requests generation of incident evidence pack and stores download URLs.
  const generateEvidencePack = async () => {
    if (!selectedIncident) {
      return;
    }

    try {
      setIsGeneratingEvidence(true);
      setActionError(null);
      const response = await apiFetch<IncidentEvidencePack>(
        `/incidents/${selectedIncident.id}/evidence-pack`,
      );
      setEvidencePack(response);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setActionError(error.message);
      } else {
        setActionError('Failed to generate evidence pack');
      }
    } finally {
      setIsGeneratingEvidence(false);
    }
  };

  const timelineRows = buildIncidentTimeline(
    selectedIncident,
    incidentTimelineEventsQuery.data ?? [],
  );

  return (
    <PageShell
      title="Incidents"
      description="Crash/theft incident queue with workflow actions and evidence downloads."
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as IncidentStatusFilter);
              setPage(1);
            }}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value}
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
            onClick={() => {
              setStatus('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-muted"
          >
            Reset Filters
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Bike</th>
                <th className="px-2 py-2">Device</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(incidentsQuery.data?.data ?? []).map((incident) => (
                <tr key={incident.id} className="border-t border-line">
                  <td className="px-2 py-2 text-ink-soft">
                    {new Date(incident.createdAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-ink">{incident.bikeId?.slice(0, 8) ?? 'N/A'}</td>
                  <td className="px-2 py-2 text-ink-soft">
                    {incident.deviceId.slice(0, 8)}...
                  </td>
                  <td className="px-2 py-2">
                    <StatusPill
                      label={incident.status}
                      tone={
                        incident.status === 'OPEN'
                          ? 'danger'
                          : incident.status === 'ACKNOWLEDGED'
                            ? 'warning'
                            : 'success'
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-muted"
                      onClick={() => {
                        setSelectedIncidentId(incident.id);
                        setEvidencePack(null);
                        setActionError(null);
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={incidentsQuery.data?.page ?? page}
          totalPages={incidentsQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </section>

      {selectedIncident ? (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Incident {selectedIncident.id.slice(0, 8)}...
          </h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-line bg-surface-muted p-3">
              <h3 className="font-semibold text-ink">Timeline</h3>
              <ul className="mt-2 space-y-2">
                {timelineRows.map((row) => (
                  <li key={row.id} className="rounded-lg border border-line bg-white px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-ink">{row.title}</p>
                      <p className="text-xs text-ink-soft">
                        {new Date(row.ts).toLocaleString()}
                      </p>
                    </div>
                    {row.description ? (
                      <p className="mt-1 text-xs text-ink-soft">{row.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border border-line bg-surface-muted p-3">
              <h3 className="font-semibold text-ink">Actions</h3>
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                placeholder="Optional notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={() => runIncidentAction('acknowledge')}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={() => runIncidentAction('resolve')}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={() => runIncidentAction('false-alarm')}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  False Alarm
                </button>
              </div>

              <button
                type="button"
                disabled={isGeneratingEvidence}
                onClick={generateEvidencePack}
                className="mt-4 w-full rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isGeneratingEvidence ? 'Generating...' : 'Generate Evidence Pack'}
              </button>

              {actionError ? (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {actionError}
                </p>
              ) : null}

              {evidencePack ? (
                <div className="mt-4 rounded-xl border border-line bg-white p-3">
                  <p className="text-sm font-semibold text-ink">Evidence Pack Ready</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Expires in {Math.round(evidencePack.expiresInSeconds / 60)} minutes
                  </p>
                  <div className="mt-2 grid gap-2">
                    <a
                      href={evidencePack.summaryJsonUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line px-2 py-1 text-sm hover:bg-surface-muted"
                    >
                      Download Summary JSON
                    </a>
                    <a
                      href={evidencePack.telemetryCsvUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line px-2 py-1 text-sm hover:bg-surface-muted"
                    >
                      Download Telemetry CSV
                    </a>
                  </div>
                </div>
              ) : null}
            </article>
          </div>
        </section>
      ) : null}
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

function buildIncidentTimeline(
  incident: Incident | null,
  events: FleetEvent[],
): Array<{ id: string; ts: string; title: string; description?: string }> {
  if (!incident) {
    return [];
  }

  const rows: Array<{ id: string; ts: string; title: string; description?: string }> = [
    {
      id: `incident-created-${incident.id}`,
      ts: incident.createdAt,
      title: 'Incident opened',
      description: `Status ${incident.status}`,
    },
  ];

  if (incident.acknowledgedAt) {
    rows.push({
      id: `incident-ack-${incident.id}`,
      ts: incident.acknowledgedAt,
      title: 'Incident acknowledged',
      description: incident.notes ?? undefined,
    });
  }

  if (incident.resolvedAt) {
    rows.push({
      id: `incident-resolved-${incident.id}`,
      ts: incident.resolvedAt,
      title: `Incident ${incident.status === 'FALSE_ALARM' ? 'marked false alarm' : 'resolved'}`,
      description: incident.notes ?? undefined,
    });
  }

  for (const event of events) {
    rows.push({
      id: `event-${event.id}`,
      ts: event.ts,
      title: `${event.type} (${event.severity})`,
      description: event.bikeId ? `Bike ${event.bikeId.slice(0, 8)}...` : undefined,
    });
  }

  return rows.sort((left, right) => left.ts.localeCompare(right.ts));
}
