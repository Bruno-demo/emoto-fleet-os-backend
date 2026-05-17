'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileArchive,
  ShieldAlert,
  Siren,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { canUseFeature } from '@/lib/subscription';
import type { Bike, FleetEvent, Incident, IncidentEvidencePack, IncidentStats, PaginatedResponse } from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimeAgo, formatTimestamp } from '@/lib/ui';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { DrawerSkeleton, Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';

const PAGE_SIZE = 20;
type IncidentStatusFilter = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM' | '';
type IncidentAction = 'acknowledge' | 'resolve' | 'false-alarm';

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<IncidentStatusFilter>('OPEN');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<IncidentAction | null>(null);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [evidencePack, setEvidencePack] = useState<IncidentEvidencePack | null>(null);
  const [isGeneratingEvidence, setIsGeneratingEvidence] = useState(false);
  const canGenerateEvidence = canUseFeature(currentUser, 'evidence');

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

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'incident-labels'],
    queryFn: () => apiFetch<PaginatedResponse<Bike>>('/bikes?page=1&pageSize=100'),
  });

  const selectedIncidentQuery = useQuery({
    queryKey: ['incidents', selectedIncidentId, 'detail'],
    queryFn: () => apiFetch<Incident>(`/incidents/${selectedIncidentId}`),
    enabled: !!selectedIncidentId,
  });

  const selectedIncident = selectedIncidentQuery.data ?? null;

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

  const bikeLabelById = useMemo(() => {
    const bikeMap = new Map<string, string>();
    for (const bike of bikesQuery.data?.data ?? []) {
      bikeMap.set(bike.id, bike.label);
    }
    return bikeMap;
  }, [bikesQuery.data?.data]);

  const incidents = useMemo(() => incidentsQuery.data?.data ?? [], [incidentsQuery.data?.data]);
  const incidentsStatsQuery = useQuery({
    queryKey: ['incidents', 'stats'],
    queryFn: () => apiFetch<IncidentStats>('/incidents/stats'),
  });

  const incidentStats = incidentsStatsQuery.data ?? {
    open: 0,
    acknowledged: 0,
    resolved: 0,
    falseAlarm: 0,
  };

  const timelineRows = useMemo(
    () => buildIncidentTimeline(selectedIncident, incidentTimelineEventsQuery.data ?? [], bikeLabelById),
    [bikeLabelById, incidentTimelineEventsQuery.data, selectedIncident],
  );

  // Clears transient evidence and form state whenever the operator opens a different incident.
  useEffect(() => {
    setEvidencePack(null);
    setActionError(null);
    setNotes('');
  }, [selectedIncidentId]);

  // Applies the selected incident workflow action and refreshes both list and detail state.
  const runIncidentAction = async (action: IncidentAction) => {
    if (!selectedIncidentId) {
      return;
    }

    setActionError(null);
    try {
      setIsSubmittingAction(true);
      await apiFetch<Incident>(`/incidents/${selectedIncidentId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || undefined }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['incidents', selectedIncidentId, 'detail'] }),
      ]);
      setPendingAction(null);
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

  // Requests generation of the incident evidence pack and stores the returned download links.
  const generateEvidencePack = async () => {
    if (!selectedIncidentId) {
      return;
    }
    if (!canGenerateEvidence) {
      setActionError('Evidence packs are available on Operations Plus.');
      return;
    }

    try {
      setIsGeneratingEvidence(true);
      setActionError(null);
      const response = await apiFetch<IncidentEvidencePack>(
        `/incidents/${selectedIncidentId}/evidence-pack`,
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

  const columns = useMemo<Array<DataTableColumn<Incident>>>(() => [
    {
      header: 'Incident',
      render: (incident) => (
        <div>
          <p className="font-semibold text-ink">{maskIdentifier(incident.id)}</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">
            Created {formatTimestamp(incident.createdAt)}
          </p>
        </div>
      ),
    },
    {
      header: 'Bike',
      render: (incident) => (
        <div>
          <p className="font-semibold text-ink">
            {incident.bikeId ? bikeLabelById.get(incident.bikeId) ?? maskIdentifier(incident.bikeId) : 'No bike linked'}
          </p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">
            Device {maskIdentifier(incident.deviceId)}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (incident) => <IncidentStatusBadge status={incident.status} />,
    },
    {
      header: 'Updated',
      render: (incident) => (
        <div>
          <p className="font-semibold text-ink">{formatTimeAgo(incident.updatedAt)}</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">{formatTimestamp(incident.updatedAt)}</p>
        </div>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (incident) => (
        <button
          type="button"
          onClick={() => setSelectedIncidentId(incident.id)}
          className="rounded-xl border border-line bg-surface-hover px-3.5 py-2 text-xs font-semibold text-accent transition hover:bg-surface-muted hover:border-accent/30"
        >
          Open detail
        </button>
      ),
    },
  ], [bikeLabelById]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Open"
          value={String(incidentStats.open)}
          hint="Incidents waiting for the first dispatcher action."
          icon={<AlertCircle size={18} />}
          tone="danger"
        />
        <MetricCard
          title="Acknowledged"
          value={String(incidentStats.acknowledged)}
          hint="Incidents owned by dispatch but not yet closed."
          icon={<ShieldAlert size={18} />}
          tone="warning"
        />
        <MetricCard
          title="Resolved"
          value={String(incidentStats.resolved)}
          hint="Incidents resolved in the current result set."
          icon={<CheckCircle2 size={18} />}
          tone="success"
        />
        <MetricCard
          title="False Alarm"
          value={String(incidentStats.falseAlarm)}
          hint="Incidents closed as non-actionable."
          icon={<Siren size={18} />}
          tone="info"
        />
      </section>

      <DashboardCard eyebrow="Incident Queue" title="Dispatcher workflow" description="Use status tabs for fast triage, then open an incident drawer to acknowledge, resolve, or package evidence.">
        <DataTableToolbar
          actions={
            <button
              type="button"
              onClick={() => {
                setStatus('OPEN');
                setFrom('');
                setTo('');
                setPage(1);
              }}
              className="rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-muted"
            >
              Reset to open queue
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusTab label="All" active={status === ''} count={incidentsQuery.data?.total ?? 0} onClick={() => { setStatus(''); setPage(1); }} />
              <StatusTab label="Open" active={status === 'OPEN'} count={incidentStats.open} tone="danger" onClick={() => { setStatus('OPEN'); setPage(1); }} />
              <StatusTab label="Acknowledged" active={status === 'ACKNOWLEDGED'} count={incidentStats.acknowledged} tone="warning" onClick={() => { setStatus('ACKNOWLEDGED'); setPage(1); }} />
              <StatusTab label="Resolved" active={status === 'RESOLVED'} count={incidentStats.resolved} tone="success" onClick={() => { setStatus('RESOLVED'); setPage(1); }} />
              <StatusTab label="False Alarm" active={status === 'FALSE_ALARM'} count={incidentStats.falseAlarm} onClick={() => { setStatus('FALSE_ALARM'); setPage(1); }} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <FilterField label="From" type="datetime-local" value={from} onChange={(value) => { setFrom(value); setPage(1); }} />
              <FilterField label="To" type="datetime-local" value={to} onChange={(value) => { setTo(value); setPage(1); }} />
              <div className="rounded-[var(--radius-panel)] border border-line bg-surface-muted px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Queue size</p>
                <p className="mt-2 font-display text-3xl font-semibold text-ink">{incidentsQuery.data?.total ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">Rows matched by the current status and time filters.</p>
              </div>
            </div>
          </div>
        </DataTableToolbar>

        <div className="mt-6">
          <DataTable
            data={incidents}
            columns={columns}
            keyExtractor={(incident) => incident.id}
            loading={incidentsQuery.isLoading}
            emptyState={
              <EmptyState
                icon={<AlertCircle size={18} />}
                title="No incidents in this queue"
                description="Adjust the time filters or switch tabs to inspect other incident states."
              />
            }
          />
        </div>

        <PaginationControls
          page={incidentsQuery.data?.page ?? page}
          totalPages={incidentsQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </DashboardCard>

      <Drawer
        open={!!selectedIncidentId}
        title={selectedIncident ? maskIdentifier(selectedIncident.id) : 'Incident detail'}
        description="Review timeline context, take the next workflow action, and manage evidence-pack output."
        onClose={() => {
          setSelectedIncidentId(null);
          setPendingAction(null);
          setActionError(null);
        }}
      >
        {!selectedIncidentId ? null : selectedIncidentQuery.isLoading ? (
          <DrawerSkeleton />
        ) : !selectedIncident ? (
          <EmptyState
            icon={<AlertCircle size={18} />}
            title="Incident detail unavailable"
            description="This incident could not be loaded. Refresh the queue and try again."
          />
        ) : (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <KeyMetric label="Status" value={<IncidentStatusBadge status={selectedIncident.status} />} />
              <KeyMetric label="Created" value={<span>{formatTimestamp(selectedIncident.createdAt)}</span>} />
              <KeyMetric
                label="Bike"
                value={<span>{selectedIncident.bikeId ? bikeLabelById.get(selectedIncident.bikeId) ?? maskIdentifier(selectedIncident.bikeId) : 'No bike linked'}</span>}
              />
              <KeyMetric label="Last updated" value={<span>{formatTimeAgo(selectedIncident.updatedAt)}</span>} />
            </section>

            <DashboardCard eyebrow="Actions" title="Primary workflow" description="Use notes for handoff context, then move the incident to its next operational state.">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-ink">
                  Notes
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional resolution context, handoff details, or false-alarm reasoning."
                    className="mt-2 min-h-28 w-full rounded-[var(--radius-panel)] border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <ActionCard
                    label="Acknowledge"
                    description="Claim the incident and remove it from the unowned queue."
                    disabled={selectedIncident.status !== 'OPEN' || isSubmittingAction}
                    tone="info"
                    onClick={() => setPendingAction('acknowledge')}
                  />
                  <ActionCard
                    label="Resolve"
                    description="Close the incident after the response workflow is complete."
                    disabled={(selectedIncident.status !== 'OPEN' && selectedIncident.status !== 'ACKNOWLEDGED') || isSubmittingAction}
                    tone="success"
                    onClick={() => setPendingAction('resolve')}
                  />
                  <ActionCard
                    label="False Alarm"
                    description="Close the incident as non-actionable without marking it resolved."
                    disabled={(selectedIncident.status !== 'OPEN' && selectedIncident.status !== 'ACKNOWLEDGED') || isSubmittingAction}
                    tone="warning"
                    onClick={() => setPendingAction('false-alarm')}
                  />
                </div>

                {actionError ? <InlineNotice message={actionError} /> : null}
              </div>
            </DashboardCard>

            <DashboardCard eyebrow="Evidence Pack" title="Crash artifacts" description="Generate a fresh evidence pack when the incident needs an exportable summary and telemetry window.">
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={isGeneratingEvidence || !canGenerateEvidence}
                  onClick={() => {
                    void generateEvidencePack();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-ink px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileArchive size={16} />
                  {isGeneratingEvidence ? 'Generating evidence pack...' : 'Generate evidence pack'}
                </button>
                {!canGenerateEvidence ? (
                  <InlineNotice message="Evidence packs are available on Operations Plus." />
                ) : null}

                {isGeneratingEvidence ? (
                  <div className="space-y-2 rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ) : evidencePack ? (
                  <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">Evidence pack ready</p>
                        <p className="mt-1 text-xs leading-5 text-ink-soft">
                          Generated {formatTimeAgo(evidencePack.createdAt)} · expires in {Math.round(evidencePack.expiresInSeconds / 60)} min
                        </p>
                      </div>
                      <span className="rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink">
                        Fresh
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <a
                        href={evidencePack.summaryJsonUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover"
                      >
                        Download summary JSON
                      </a>
                      <a
                        href={evidencePack.telemetryCsvUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover"
                      >
                        Download telemetry CSV
                      </a>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileArchive size={18} />}
                    title="No evidence pack generated yet"
                    description="Generate a pack to create short-lived links for the JSON summary and telemetry CSV window."
                  />
                )}
              </div>
            </DashboardCard>

            <DashboardCard eyebrow="Timeline" title="Incident context" description="Timeline rows blend the incident workflow with nearby bike events so dispatch can reconstruct what happened.">
              {incidentTimelineEventsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-18 w-full rounded-[18px]" />
                  <Skeleton className="h-18 w-full rounded-[18px]" />
                  <Skeleton className="h-18 w-full rounded-[18px]" />
                </div>
              ) : timelineRows.length ? (
                <ul className="space-y-2">
                  {timelineRows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-[18px] border border-line bg-surface-muted px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-ink">{row.title}</p>
                        <span className="text-xs font-medium text-ink-soft">{formatTimestamp(row.ts)}</span>
                      </div>
                      {row.description ? (
                        <p className="mt-2 text-xs leading-5 text-ink-soft">{row.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Clock3 size={18} />}
                  title="No timeline events"
                  description="This incident does not yet have nearby event context in the loaded time window."
                />
              )}
            </DashboardCard>
          </div>
        )}
      </Drawer>

      <ConfirmModal
        open={!!pendingAction}
        title={pendingAction ? actionTitle(pendingAction) : 'Confirm incident action'}
        description={pendingAction ? actionDescription(pendingAction, selectedIncident) : ''}
        confirmLabel={pendingAction ? actionConfirmLabel(pendingAction) : 'Confirm'}
        tone={pendingAction === 'false-alarm' ? 'danger' : 'default'}
        isSubmitting={isSubmittingAction}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) {
            void runIncidentAction(pendingAction);
          }
        }}
      />
    </div>
  );
}

function StatusTab({
  label,
  active,
  count,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
  onClick: () => void;
}) {
  const toneClasses = active
    ? tone === 'danger'
      ? 'border-danger-ink/30 bg-danger-soft text-danger-ink'
      : tone === 'warning'
        ? 'border-warning-ink/30 bg-warning-soft text-warning-ink'
        : tone === 'success'
          ? 'border-success-ink/30 bg-success-soft text-success-ink'
          : 'border-line-strong bg-surface-hover text-ink'
    : 'border-line bg-surface-muted text-ink-muted hover:bg-surface-hover';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
        toneClasses,
      )}
    >
      {label}{' '}
      <span className="ml-1.5 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] tabular-nums">
        {count}
      </span>
    </button>
  );
}

function FilterField({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: 'datetime-local';
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-line bg-surface-hover px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
      />
    </label>
  );
}

function KeyMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function ActionCard({
  label,
  description,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  description: string;
  disabled: boolean;
  tone: 'info' | 'success' | 'warning';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'rounded-xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'success'
          ? 'border-success-ink/20 bg-success-soft/40 hover:bg-success-soft/60'
          : tone === 'warning'
            ? 'border-warning-ink/20 bg-warning-soft/40 hover:bg-warning-soft/60'
            : 'border-accent/20 bg-accent/10 hover:bg-accent/20',
      )}
    >
      <p className="font-semibold text-ink">{label}</p>
      <p className="mt-2 text-xs leading-5 text-ink-muted">{description}</p>
    </button>
  );
}

function InlineNotice({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
      {message}
    </p>
  );
}

function IncidentStatusBadge({ status }: { status: Incident['status'] }) {
  return (
    <span
      className={
        status === 'OPEN'
          ? 'inline-flex rounded-full bg-danger-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger-ink'
          : status === 'ACKNOWLEDGED'
            ? 'inline-flex rounded-full bg-warning-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-warning-ink'
            : status === 'RESOLVED'
              ? 'inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
              : 'inline-flex rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft'
      }
    >
      {formatEnumLabel(status)}
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

// Builds a descending timeline that combines workflow milestones with nearby events.
function buildIncidentTimeline(
  incident: Incident | null,
  events: FleetEvent[],
  bikeLabelById: Map<string, string>,
) {
  if (!incident) {
    return [] as Array<{ id: string; ts: string; title: string; description?: string }>;
  }

  const rows: Array<{ id: string; ts: string; title: string; description?: string }> = [
    {
      id: `incident-created-${incident.id}`,
      ts: incident.createdAt,
      title: 'Incident opened',
      description: `Status ${formatEnumLabel(incident.status)}`,
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
      title: `${formatEnumLabel(event.type)} (${event.severity})`,
      description: event.bikeId
        ? bikeLabelById.get(event.bikeId) ?? `Bike ${maskIdentifier(event.bikeId)}`
        : undefined,
    });
  }

  return rows.sort((left, right) => right.ts.localeCompare(left.ts));
}

function actionTitle(action: IncidentAction) {
  if (action === 'acknowledge') {
    return 'Acknowledge incident';
  }
  if (action === 'resolve') {
    return 'Resolve incident';
  }
  return 'Mark false alarm';
}

function actionConfirmLabel(action: IncidentAction) {
  if (action === 'acknowledge') {
    return 'Confirm acknowledge';
  }
  if (action === 'resolve') {
    return 'Confirm resolve';
  }
  return 'Confirm false alarm';
}

function actionDescription(action: IncidentAction, incident: Incident | null) {
  const incidentLabel = incident ? maskIdentifier(incident.id) : 'this incident';
  if (action === 'acknowledge') {
    return `Move ${incidentLabel} into the acknowledged queue and assign ownership to the current operator.`;
  }
  if (action === 'resolve') {
    return `Close ${incidentLabel} as resolved. Add notes first if the response needs handoff context.`;
  }
  return `Close ${incidentLabel} as a false alarm. Use notes to explain why dispatch dismissed it.`;
}

function maskIdentifier(value: string | null | undefined) {
  if (!value) {
    return 'N/A';
  }
  return `${value.slice(0, 8)}...`;
}

