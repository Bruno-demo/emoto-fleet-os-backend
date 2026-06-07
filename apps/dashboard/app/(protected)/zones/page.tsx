'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { canManageZones } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { PaginatedResponse, Zone } from '@/lib/types/dashboard';
import { formatEnumLabel } from '@/lib/ui';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice, SelectField, TextAreaField, TextField } from '@/components/ui/form-controls';
import { PaginationControls } from '@/components/ui/pagination-controls';

const ZoneDrawMap = dynamic(
  () => import('@/components/zones/zone-draw-map'),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full rounded-xl border border-line bg-surface-muted flex items-center justify-center text-xs text-ink-soft">
        Loading drawing canvas...
      </div>
    ),
  },
);

const PAGE_SIZE = 20;

const zoneFormSchema = z.object({
  name: z.string().min(2, 'Zone name must be at least 2 characters'),
  type: z.enum(['SLOW', 'NO_GO', 'PARK']),
  speedLimitKph: z.number().nullable(),
  active: z.boolean(),
  geojsonPolygon: z.string().min(2, 'Please draw a valid boundary on the map or provide a valid coordinates string'),
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

const defaultPoints: Array<[number, number]> = [
  [30.06, -1.95],
  [30.065, -1.95],
  [30.065, -1.945],
  [30.06, -1.945],
];

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
  const [points, setPoints] = useState<Array<[number, number]>>(defaultPoints);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePointsChange = (newPoints: Array<[number, number]>) => {
    setPoints(newPoints);
    if (newPoints.length > 0) {
      // Close the polygon by appending the first point at the end
      const coordinates = [...newPoints, newPoints[0]];
      const geojson = {
        type: 'Polygon',
        coordinates: [coordinates],
      };
      setGeojsonPolygon(JSON.stringify(geojson, null, 2));
    } else {
      setGeojsonPolygon('');
    }
  };

  const mapCenter = useMemo<[number, number] | null>(() => {
    if (points.length > 0) {
      return [points[0][1], points[0][0]];
    }
    return null;
  }, [points]);

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
    [editingZoneId, zonesQuery.data?.data],
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

  // Resets the fallback GeoJSON editor to a clean default state.
  const resetForm = () => {
    setEditingZoneId(null);
    setName('');
    setType('SLOW');
    setSpeedLimitKph('');
    setActive(true);
    setGeojsonPolygon(defaultPolygon);
    setPoints(defaultPoints);
    setFormError(null);
  };

  // Loads the selected zone into the form so operators can update it safely.
  const beginEditing = (zone: Zone) => {
    setEditingZoneId(zone.id);
    setName(zone.name);
    setType(zone.type);
    setSpeedLimitKph(zone.speedLimitKph?.toString() ?? '');
    setActive(zone.active);
    setGeojsonPolygon(JSON.stringify(zone.geojsonPolygon, null, 2));
    setFormError(null);

    // Sync points for map drawing
    const polygon = zone.geojsonPolygon as Record<string, unknown>;
    if (polygon && polygon.type === 'Polygon') {
      const rawCoords = (polygon.coordinates as Array<Array<[number, number]>>)?.[0] || [];
      // Remove last duplicate element that closes the GeoJSON loop
      const cleanPoints = rawCoords.slice(0, -1);
      setPoints(cleanPoints);
    } else {
      setPoints([]);
    }
  };

  // Creates or updates a zone record using the GeoJSON fallback editor.
  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const maybeSpeedLimit =
      speedLimitKph.trim().length === 0 ? null : Number(speedLimitKph.trim());
    if (maybeSpeedLimit !== null && Number.isNaN(maybeSpeedLimit)) {
      setFormError('Speed limit must be a valid number');
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
      setFormError('Slow-speed zones require a positive speed limit.');
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

  const deleteZone = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await apiFetch(`/zones/${deleteTarget.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['zones'] });
      if (editingZoneId === deleteTarget.id) {
        resetForm();
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Unable to delete zone');
      }
    }
  };

  const columns = useMemo<Array<DataTableColumn<Zone>>>(
    () => [
      {
        header: 'Zone',
        render: (zone) => (
          <div>
            <p className="font-semibold text-ink">{zone.name}</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{formatEnumLabel(zone.type)}</p>
          </div>
        ),
      },
      {
        header: 'Status',
        render: (zone) => (
          <span
            className={
              zone.active
                ? 'inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
                : 'inline-flex rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft'
            }
          >
            {zone.active ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        header: 'Speed limit',
        render: (zone) => (
          <span className="text-sm text-ink-soft">
            {zone.type === 'SLOW' ? `${zone.speedLimitKph ?? '--'} kph` : 'N/A'}
          </span>
        ),
      },
      {
        header: 'Action',
        className: 'text-right',
        cellClassName: 'text-right',
        render: (zone) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => beginEditing(zone)}
              className="rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-hover"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(zone)}
              className="rounded-[var(--radius-control)] bg-danger-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger-strong"
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  if (currentUser && !isAdmin) {
    return (
      <div className="space-y-6">
        <DashboardCard eyebrow="Access" title="Zone management is restricted" description="This account cannot create, edit, or delete geofence policy boundaries.">
          <EmptyState
            icon={<ShieldCheck size={18} />}
            title="No zone-management access"
            description="Switch to an admin account to manage slow, no-go, or parking boundaries."
          />
        </DashboardCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <DashboardCard eyebrow="Zone Registry" title="Geofence list" description="Edit fleet boundaries with safer inline actions and a clearer GeoJSON fallback view.">
          <div className="mt-1">
            <DataTable
              data={zonesQuery.data?.data ?? []}
              columns={columns}
              keyExtractor={(zone) => zone.id}
              loading={zonesQuery.isLoading}
              emptyState={
                <EmptyState
                  icon={<MapPin size={18} />}
                  title="No zones yet"
                  description="Create your first zone to begin enforcing slow, no-go, or park rules."
                />
              }
            />
          </div>

          <PaginationControls
            page={zonesQuery.data?.page ?? page}
            totalPages={zonesQuery.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </DashboardCard>

        <DashboardCard
          eyebrow="Zone Editor"
          title={editingZone ? `Editing ${editingZone.name}` : 'Create a zone'}
          description="Use the GeoJSON fallback editor for now. SLOW zones require a positive speed limit."
        >
          <form className="space-y-4" onSubmit={submitForm}>
            <TextField
              label="Zone name"
              placeholder="Downtown slow zone"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <SelectField
                label="Zone type"
                value={type}
                onChange={(event) => setType(event.target.value as 'SLOW' | 'NO_GO' | 'PARK')}
              >
                <option value="SLOW">Slow</option>
                <option value="NO_GO">No-go</option>
                <option value="PARK">Park</option>
              </SelectField>

              <TextField
                label="Speed limit kph"
                placeholder={type === 'SLOW' ? '20' : 'Not required'}
                value={speedLimitKph}
                onChange={(event) => setSpeedLimitKph(event.target.value)}
                disabled={type !== 'SLOW'}
              />
            </div>

            <label className="flex items-center gap-3 rounded-[18px] border border-line bg-surface-muted px-4 py-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className="h-4 w-4 rounded border-line text-accent"
              />
              Zone is active
            </label>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Map Boundary Editor</label>
              <div className="text-[11px] text-zinc-500 mb-1 leading-relaxed">
                Click on the map below to define geofence boundary corners. Connect at least 3 points to form a closed shape.
              </div>
              <ZoneDrawMap
                points={points}
                onChange={handlePointsChange}
                center={mapCenter}
              />
            </div>

            <details className="group border border-line bg-surface-muted rounded-xl">
              <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-xs font-semibold text-zinc-400 select-none">
                <span>Advanced: Raw GeoJSON Coordinates</span>
                <span className="text-[10px] text-zinc-500 group-open:hidden">Show</span>
                <span className="text-[10px] text-zinc-500 hidden group-open:inline">Hide</span>
              </summary>
              <div className="px-4 pb-4 border-t border-line/5 pt-3">
                <TextAreaField
                  label=""
                  hint="GeoJSON Polygon string"
                  value={geojsonPolygon}
                  onChange={(event) => {
                    setGeojsonPolygon(event.target.value);
                    try {
                      const parsed = JSON.parse(event.target.value);
                      if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
                        const rawCoords = parsed.coordinates[0];
                        setPoints(rawCoords.slice(0, -1));
                      }
                    } catch {
                      // Skip sync if invalid JSON
                    }
                  }}
                  className="min-h-32 font-mono text-xs"
                />
              </div>
            </details>

            {formError ? <InlineNotice message={formError} /> : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover"
              >
                Reset form
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-[var(--radius-control)] bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? editingZone
                    ? 'Saving zone...'
                    : 'Creating zone...'
                  : editingZone
                    ? 'Save zone changes'
                    : 'Create zone'}
              </button>
            </div>
          </form>
        </DashboardCard>
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete zone"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? This removes the zone from fleet policy enforcement.`
            : ''
        }
        confirmLabel="Delete zone"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void deleteZone();
        }}
      />
    </div>
  );
}

