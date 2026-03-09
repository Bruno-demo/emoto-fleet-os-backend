'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock3,
  FileArchive,
  ShieldCheck,
  Siren,
} from 'lucide-react';
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
      (incidentsQuery.data?.data ?? []).find((incident) => incident.id === selectedIncidentId) ??
      null,
    [incidentsQuery.data?.data, selectedIncidentId],
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

  const incidentStats = useMemo(() => {
    const incidents = incidentsQuery.data?.data ?? [];
    return {
      open: incidents.filter((incident) => incident.status === 'OPEN').length,
      acknowledged: incidents.filter((incident) => incident.status === 'ACKNOWLEDGED').length,
      resolved: incidents.filter((incident) => incident.status === 'RESOLVED').length,
      falseAlarm: incidents.filter((incident) => incident.status === 'FALSE_ALARM').length,
    };
  }, [incidentsQuery.data?.data]);

  const incidents = incidentsQuery.data?.data ?? [];

  // Applies the selected incident workflow action and refreshes the list state.
  const runIncidentAction = async (action: 'acknowledge' | 'resolve' | 'false-alarm') => {
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

  // Requests generation of the incident evidence pack and stores the resulting links.
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
      description="Manage crash and theft workflows, drive dispatcher acknowledgement, and generate evidence packs when the incident must leave the dashboard."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Open"
          value={String(incidentStats.open)}
          hint="Incidents awaiting first dispatcher action."
          icon={<AlertCircle size={18} />}
          tone="danger"
        />
        <MetricCard
          title="Acknowledged"
          value={String(incidentStats.acknowledged)}
          hint="Incidents owned but not yet resolved."
          icon={<ShieldCheck size={18} />}
          tone="warning"
        />
        <MetricCard
          title="Resolved"
          value={String(incidentStats.resolved)}
          hint="Incidents closed during the current filtered result window."
          icon={<Clock3 size={18} />}
          tone="success"
        />
        <MetricCard
          title="False Alarm"
          value={String(incidentStats.falseAlarm)}
          hint="Closed incidents dismissed as non-actionable."
          icon={<Siren size={18} />}
          tone="info"
        />
      </section>

      <section className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Incident Queue
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              Active workflow list
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as IncidentStatusFilter);
                setPage(1);
              }}
              className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
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
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
            />

            <input
              type="datetime-local"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
            />

            <button
              type="button"
              onClick={() => {
                setStatus('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
              className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.16em] text-ink-soft">
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Bike</th>
                <th className="px-3 py-3">Device</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id} className="border-b border-line/70 last:border-b-0">
                  <td className="px-3 py-4 text-ink-soft">{formatTimestamp(incident.createdAt)}</td>
                  <td className="px-3 py-4 text-ink">
                    {incident.bikeId ? incident.bikeId.slice(0, 8) : 'N/A'}
                  </td>
                  <td className="px-3 py-4 text-ink-soft">{incident.deviceId.slice(0, 8)}...</td>
                  <td className="px-3 py-4">
                    <StatusPill label={incident.status} tone={incidentStatusTone(incident.status)} />
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      className="rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-muted"
                      onClick={() => {
                        setSelectedIncidentId(incident.id);
                        setEvidencePack(null);
                        setActionError(null);
                      }}
                    >
                      Open detail
                    </button>
                  </td>
                </tr>
              ))}
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-ink-soft">
                    No incidents match the current filter set.
                  </td>
                </tr>
              ) : null}
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
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  Incident Detail
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
                  {selectedIncident.id.slice(0, 8)}...
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill
                    label={selectedIncident.status}
                    tone={incidentStatusTone(selectedIncident.status)}
                  />
                  <StatusPill
                    label={selectedIncident.bikeId ? `Bike ${selectedIncident.bikeId.slice(0, 8)}` : 'No bike'}
                    tone="neutral"
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
                Opened {formatTimestamp(selectedIncident.createdAt)}
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-line bg-surface-muted p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-white p-2 text-accent">
                  <Clock3 size={16} />
                </span>
                <h3 className="font-display text-lg font-semibold text-ink">Timeline</h3>
              </div>

              <ul className="mt-4 space-y-3">
                {timelineRows.map((row) => (
                  <li key={row.id} className="rounded-2xl border border-line bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-ink">{row.title}</p>
                      <p className="text-xs text-ink-soft">{formatTimestamp(row.ts)}</p>
                    </div>
                    {row.description ? (
                      <p className="mt-1 text-xs text-ink-soft">{row.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Workflow Actions
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              Dispatcher controls
            </h2>

            <textarea
              className="mt-5 min-h-28 w-full rounded-3xl border border-line bg-surface-muted px-4 py-4 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
              placeholder="Optional notes for acknowledgement, resolution, or false-alarm reasoning."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => runIncidentAction('acknowledge')}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                Acknowledge
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => runIncidentAction('resolve')}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resolve
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => runIncidentAction('false-alarm')}
                className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                False Alarm
              </button>
            </div>

            <div className="mt-5 rounded-[28px] border border-line bg-surface-muted p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-white p-2 text-accent">
                  <FileArchive size={16} />
                </span>
                <h3 className="font-display text-lg font-semibold text-ink">Evidence Pack</h3>
              </div>

              <button
                type="button"
                disabled={isGeneratingEvidence}
                onClick={generateEvidencePack}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileArchive size={16} />
                {isGeneratingEvidence ? 'Generating...' : 'Generate Evidence Pack'}
              </button>

              {evidencePack ? (
                <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                  <p className="text-sm font-semibold text-ink">Evidence pack ready</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Expires in {Math.round(evidencePack.expiresInSeconds / 60)} minutes
                  </p>
                  <div className="mt-3 grid gap-2">
                    <a
                      href={evidencePack.summaryJsonUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted"
                    >
                      Download Summary JSON
                    </a>
                    <a
                      href={evidencePack.telemetryCsvUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted"
                    >
                      Download Telemetry CSV
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            {actionError ? (
              <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {actionError}
              </p>
            ) : null}
          </article>
        </section>
      ) : null}
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

function incidentStatusTone(status: Incident['status']) {
  if (status === 'OPEN') {
    return 'danger' as const;
  }
  if (status === 'ACKNOWLEDGED') {
    return 'warning' as const;
  }
  if (status === 'RESOLVED') {
    return 'success' as const;
  }
  return 'neutral' as const;
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

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
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
      title: incident.status === 'FALSE_ALARM' ? 'Marked false alarm' : 'Incident resolved',
      description: incident.notes ?? undefined,
    });
  }

  for (const event of events) {
    rows.push({
      id: `event-${event.id}`,
      ts: event.ts,
      title: `${formatEventType(event.type)} (${event.severity})`,
      description: event.bikeId ? `Bike ${event.bikeId.slice(0, 8)}...` : undefined,
    });
  }

  return rows.sort((left, right) => left.ts.localeCompare(right.ts));
}

function formatEventType(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
