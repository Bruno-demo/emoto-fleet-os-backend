'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    [zonesQuery.data, editingZoneId],
  );

  const resetForm = () => {
    setEditingZoneId(null);
    setName('');
    setType('SLOW');
    setSpeedLimitKph('');
    setActive(true);
    setGeojsonPolygon(defaultPolygon);
    setFormError(null);
  };

  // Loads an existing zone into the edit form controls.
  const beginEditing = (zone: Zone) => {
    setEditingZoneId(zone.id);
    setName(zone.name);
    setType(zone.type);
    setSpeedLimitKph(zone.speedLimitKph?.toString() ?? '');
    setActive(zone.active);
    setGeojsonPolygon(JSON.stringify(zone.geojsonPolygon, null, 2));
    setFormError(null);
  };

  // Creates or updates zones using GeoJSON textarea input as polygon source.
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
        speedLimitKph:
          parsedForm.data.type === 'SLOW' ? maybeSpeedLimit : null,
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
        description="Zone editing is available only for ADMIN users."
      >
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
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
      description="Create, edit and delete geofence zones using GeoJSON polygon input."
    >
      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">Zone List</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Speed Limit</th>
                  <th className="px-2 py-2">State</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {(zonesQuery.data?.data ?? []).map((zone) => (
                  <tr key={zone.id} className="border-t border-line">
                    <td className="px-2 py-2 text-ink">{zone.name}</td>
                    <td className="px-2 py-2 text-ink-soft">{zone.type}</td>
                    <td className="px-2 py-2 text-ink-soft">
                      {zone.speedLimitKph ?? '--'}
                    </td>
                    <td className="px-2 py-2">
                      <StatusPill label={zone.active ? 'ACTIVE' : 'INACTIVE'} tone="info" />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-muted"
                          onClick={() => beginEditing(zone)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                          onClick={() => deleteZone(zone.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={zonesQuery.data?.page ?? page}
            totalPages={zonesQuery.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </article>

        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">
            {editingZone ? 'Edit Zone' : 'Create Zone'}
          </h2>
          <form className="mt-3 space-y-3" onSubmit={submitForm}>
            <input
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              placeholder="Zone name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <select
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              value={type}
              onChange={(event) =>
                setType(event.target.value as 'SLOW' | 'NO_GO' | 'PARK')
              }
            >
              <option value="SLOW">SLOW</option>
              <option value="NO_GO">NO_GO</option>
              <option value="PARK">PARK</option>
            </select>

            <input
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              placeholder="speedLimitKph (required for SLOW)"
              value={speedLimitKph}
              onChange={(event) => setSpeedLimitKph(event.target.value)}
              disabled={type !== 'SLOW'}
            />

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              Active
            </label>

            <textarea
              className="min-h-44 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs"
              value={geojsonPolygon}
              onChange={(event) => setGeojsonPolygon(event.target.value)}
              placeholder="GeoJSON Polygon"
            />

            {formError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
                className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-muted"
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
