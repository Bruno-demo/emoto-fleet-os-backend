'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { PageShell } from '@/components/layout/page-shell';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { canManageZones } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { PaginatedResponse, Zone } from '@/lib/types/dashboard';

const PAGE_SIZE = 20;

const zoneFormSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['SLOW', 'NO_GO', 'PARK']),
  speedLimitKph: z.number().nullable(),
  active: z.boolean(),
  geojsonPolygon: z.string().min(2),
});

const defaultPolygon = JSON.stringify(
  {
    type: 'Polygon',
    coordinates: [
      [
        [30.06, -1.95],
        [30.065, -1.95],
        [30.065, -1.945],
        [30.06, -1.945],
        [30.06, -1.95],
      ],
    ],
  },
  null,
  2,
);

export default function ZonesPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'SLOW' | 'NO_GO' | 'PARK'>('SLOW');
  const [speedLimitKph, setSpeedLimitKph] = useState('');
  const [active, setActive] = useState(true);
  const [geojsonPolygon, setGeojsonPolygon] = useState(defaultPolygon);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = currentUser ? canManageZones(currentUser.role) : false;

  const zonesQuery = useQuery({
    queryKey: ['zones', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Zone>>(
        `/zones${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
    enabled: isAdmin,
    retry: false,
  });

  const editingZone = useMemo(
    () => (zonesQuery.data?.data ?? []).find((zone) => zone.id === editingZoneId) ?? null,
    [zonesQuery.data?.data, editingZoneId],
  );

  const zoneStats = useMemo(() => {
    const zones = zonesQuery.data?.data ?? [];
    return {
      total: zonesQuery.data?.total ?? 0,
      active: zones.filter((zone) => zone.active).length,
      slow: zones.filter((zone) => zone.type === 'SLOW').length,
      restricted: zones.filter((zone) => zone.type === 'NO_GO').length,
    };
  }, [zonesQuery.data?.data, zonesQuery.data?.total]);

  const zones = zonesQuery.data?.data ?? [];

  const resetForm = () => {
    setEditingZoneId(null);
    setName('');
    setType('SLOW');
    setSpeedLimitKph('');
    setActive(true);
    setGeojsonPolygon(defaultPolygon);
    setFormError(null);
  };

  // Loads the selected zone into the GeoJSON editor fields for update flows.
  const beginEditing = (zone: Zone) => {
    setEditingZoneId(zone.id);
    setName(zone.name);
    setType(zone.type);
    setSpeedLimitKph(zone.speedLimitKph?.toString() ?? '');
    setActive(zone.active);
    setGeojsonPolygon(JSON.stringify(zone.geojsonPolygon, null, 2));
    setFormError(null);
  };

  // Creates or updates a zone record using the current GeoJSON fallback editor.
  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const maybeSpeedLimit =
      speedLimitKph.trim().length === 0 ? null : Number(speedLimitKph.trim());
    if (maybeSpeedLimit !== null && Number.isNaN(maybeSpeedLimit)) {
      setFormError('speedLimitKph must be a valid number');
      return;
    }

    const parsedForm = zoneFormSchema.safeParse({
      name,
      type,
      speedLimitKph: maybeSpeedLimit,
      active,
      geojsonPolygon,
    });
    if (!parsedForm.success) {
      setFormError(parsedForm.error.issues[0]?.message ?? 'Invalid form');
      return;
    }

    let parsedPolygon: unknown;
    try {
      parsedPolygon = JSON.parse(parsedForm.data.geojsonPolygon);
    } catch {
      setFormError('GeoJSON must be valid JSON');
      return;
    }

    if (parsedForm.data.type === 'SLOW' && (!maybeSpeedLimit || maybeSpeedLimit <= 0)) {
      setFormError('SLOW zones require a positive speedLimitKph');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: parsedForm.data.name,
        type: parsedForm.data.type,
        active: parsedForm.data.active,
        speedLimitKph: parsedForm.data.type === 'SLOW' ? maybeSpeedLimit : null,
        geojsonPolygon: parsedPolygon,
      };

      if (editingZoneId) {
        await apiFetch<Zone>(`/zones/${editingZoneId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<Zone>('/zones', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['zones'] });
      resetForm();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Unable to save zone');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteZone = async (zoneId: string) => {
    try {
      await apiFetch(`/zones/${zoneId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['zones'] });
      if (editingZoneId === zoneId) {
        resetForm();
      }
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Unable to delete zone');
      }
    }
  };

  if (currentUser && !isAdmin) {
    return (
      <PageShell
        title="Zones"
        description="Zone editing is available only to roles allowed to manage policy boundaries."
      >
        <section className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-sm text-ink-soft">
            You do not have permission to manage geofence zones with this account.
          </p>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Zones"
      description="Manage slow zones, no-go zones, and parking boundaries using the GeoJSON fallback editor until a map-drawing tool is added."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Zones"
          value={String(zoneStats.total)}
          hint="All geofence zones registered for the fleet."
          icon={<MapPin size={18} />}
          tone="info"
        />
        <MetricCard
          title="Active"
          value={String(zoneStats.active)}
          hint="Zones currently enforcing backend rules."
          icon={<ShieldCheck size={18} />}
          tone="success"
        />
        <MetricCard
          title="Slow Zones"
          value={String(zoneStats.slow)}
          hint="Zones with an enforced speed limit."
          icon={<Plus size={18} />}
          tone="warning"
        />
        <MetricCard
          title="No-Go"
          value={String(zoneStats.restricted)}
          hint="Restricted areas intended to trigger high-priority events."
          icon={<Trash2 size={18} />}
          tone="danger"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Zone Registry
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
                Geofence list
              </h2>
            </div>
            <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
              {zonesQuery.data?.total ?? 0} total zones
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.16em] text-ink-soft">
                  <th className="px-3 py-3">Zone</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Speed Limit</th>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="border-b border-line/70 last:border-b-0">
                    <td className="px-3 py-4">
                      <div className="flex items-start gap-3">
                        <span className="rounded-2xl bg-accent-soft p-2 text-accent">
                          <MapPin size={18} />
                        </span>
                        <div>
                          <p className="font-medium text-ink">{zone.name}</p>
                          <p className="mt-1 text-xs text-ink-soft">
                            Updated {formatTimestamp(zone.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill label={zone.type} tone={zoneTypeTone(zone.type)} />
                    </td>
                    <td className="px-3 py-4 text-ink-soft">
                      {zone.speedLimitKph ? `${zone.speedLimitKph} km/h` : '—'}
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill
                        label={zone.active ? 'ACTIVE' : 'INACTIVE'}
                        tone={zone.active ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-muted"
                          onClick={() => beginEditing(zone)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          onClick={() => deleteZone(zone.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {zones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-ink-soft">
                      No zones have been configured yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={zonesQuery.data?.page ?? page}
            totalPages={zonesQuery.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </article>

        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Zone Editor
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
            {editingZone ? 'Edit zone' : 'Create zone'}
          </h2>

          <div className="mt-5 rounded-[28px] border border-dashed border-line bg-surface-muted px-4 py-8 text-center">
            <MapPin size={28} className="mx-auto text-accent" />
            <p className="mt-3 text-sm font-medium text-ink">Map drawing fallback</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              This screen uses a GeoJSON editor until the leaflet drawing workflow is wired in.
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={submitForm}>
            <InputField label="Zone name" value={name} onChange={setName} />

            <div className="rounded-3xl border border-line bg-surface-muted px-4 py-4">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                Zone type
              </label>
              <select
                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as 'SLOW' | 'NO_GO' | 'PARK')
                }
              >
                <option value="SLOW">SLOW</option>
                <option value="NO_GO">NO_GO</option>
                <option value="PARK">PARK</option>
              </select>
            </div>

            <InputField
              label="Speed limit (km/h)"
              value={speedLimitKph}
              onChange={setSpeedLimitKph}
              disabled={type !== 'SLOW'}
              placeholder="Required for SLOW zones"
            />

            <label className="flex items-center gap-3 rounded-3xl border border-line bg-surface-muted px-4 py-4 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              Active and enforce rules immediately
            </label>

            <div className="rounded-3xl border border-line bg-surface-muted px-4 py-4">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                GeoJSON polygon
              </label>
              <textarea
                className="mt-2 min-h-52 w-full rounded-2xl border border-line bg-white px-4 py-3 font-mono text-xs text-ink outline-none transition focus:border-accent"
                value={geojsonPolygon}
                onChange={(event) => setGeojsonPolygon(event.target.value)}
                placeholder="GeoJSON Polygon"
              />
            </div>

            {formError ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingZone
                    ? 'Update Zone'
                    : 'Create Zone'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted"
              >
                Reset
              </button>
            </div>
          </form>
        </article>
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

function InputField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface-muted px-4 py-4">
      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </label>
      <input
        className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:bg-slate-100"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function zoneTypeTone(type: Zone['type']) {
  if (type === 'NO_GO') {
    return 'danger' as const;
  }
  if (type === 'SLOW') {
    return 'warning' as const;
  }
  return 'success' as const;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}
