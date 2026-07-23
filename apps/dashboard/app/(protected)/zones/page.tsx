'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, ShieldCheck, Trash2, ChevronDown, Check } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { canManageZones } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { Bike, LiveBikeState, PaginatedResponse, Zone } from '@/lib/types/dashboard';
import { cx, formatEnumLabel } from '@/lib/ui';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice, SelectField, TextAreaField, TextField } from '@/components/ui/form-controls';

import { useTranslation } from '@/components/i18n/LanguageProvider';

function LoadingDrawingCanvas() {
  const { t } = useTranslation();
  return (
    <div className="h-72 w-full rounded-xl border border-line bg-surface-muted flex items-center justify-center text-xs text-ink-soft">
      {t('Loading drawing canvas...')}
    </div>
  );
}

const ZoneDrawMap = dynamic(
  () => import('@/components/zones/zone-draw-map'),
  {
    ssr: false,
    loading: () => <LoadingDrawingCanvas />,
  },
);

const PAGE_SIZE = 20;

const zoneFormSchema = z.object({
  name: z.string().min(2, 'Zone name must be at least 2 characters'),
  type: z.enum(['SLOW', 'NO_GO', 'PARK', 'WORK_BOUNDARY']),
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

interface ZoneTemplate {
  id: string;
  name: string;
  type: 'SLOW' | 'NO_GO' | 'PARK' | 'WORK_BOUNDARY';
  speedLimitKph: string;
  description: string;
  points: Array<[number, number]>;
}

const RWANDA_ZONE_TEMPLATES: ZoneTemplate[] = [
  {
    id: 'kigali-city-boundary',
    name: 'Greater Kigali Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Full Kigali metropolitan perimeter (Nyarugenge, Gasabo & Kicukiro)',
    points: [
      [30.012, -1.905],
      [30.155, -1.905],
      [30.185, -1.985],
      [30.125, -2.035],
      [30.012, -1.985],
    ],
  },
  {
    id: 'ksez-masoro',
    name: 'Kigali Special Economic Zone (Masoro)',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Primary industrial park & warehousing logistics hub',
    points: [
      [30.150, -1.962],
      [30.168, -1.962],
      [30.168, -1.978],
      [30.150, -1.978],
    ],
  },
  {
    id: 'nyabugogo-terminal',
    name: 'Nyabugogo Transport & Bus Terminal',
    type: 'SLOW',
    speedLimitKph: '15',
    description: 'High-density bus station & central transport hub',
    points: [
      [30.042, -1.936],
      [30.054, -1.936],
      [30.054, -1.948],
      [30.042, -1.948],
    ],
  },
  {
    id: 'kacyiru-diplomatic',
    name: 'Kacyiru Government & Ministry District',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'High-security administrative & diplomatic quarter',
    points: [
      [30.076, -1.932],
      [30.095, -1.932],
      [30.095, -1.949],
      [30.076, -1.949],
    ],
  },
  {
    id: 'kimironko-market',
    name: 'Kimironko Market Commercial Hub',
    type: 'PARK',
    speedLimitKph: '',
    description: 'Retail commerce, delivery staging, & rider parking zone',
    points: [
      [30.122, -1.947],
      [30.136, -1.947],
      [30.136, -1.959],
      [30.122, -1.959],
    ],
  },
  {
    id: 'bugesera-corridor',
    name: 'Bugesera Nyamata Airport Corridor',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Southern transit route to Nyamata & Bugesera',
    points: [
      [30.082, -2.045],
      [30.145, -2.045],
      [30.145, -2.185],
      [30.082, -2.185],
    ],
  },
  {
    id: 'musanze-hub',
    name: 'Musanze Northern Logistics Hub',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Northern Province operating & tourism boundary',
    points: [
      [29.605, -1.475],
      [29.665, -1.475],
      [29.665, -1.535],
      [29.605, -1.535],
    ],
  },
  {
    id: 'rubavu-border',
    name: 'Rubavu / Gisenyi Western Border Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Western border cross-docking & lakefront zone',
    points: [
      [29.232, -1.668],
      [29.288, -1.668],
      [29.288, -1.728],
      [29.232, -1.728],
    ],
  },
];

export default function ZonesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [accumulatedZones, setAccumulatedZones] = useState<Zone[]>([]);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'SLOW' | 'NO_GO' | 'PARK' | 'WORK_BOUNDARY'>('SLOW');
  const [speedLimitKph, setSpeedLimitKph] = useState('');
  const [active, setActive] = useState(true);
  const [geojsonPolygon, setGeojsonPolygon] = useState(defaultPolygon);
  const [points, setPoints] = useState<Array<[number, number]>>(defaultPoints);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const applyTemplate = (template: ZoneTemplate) => {
    setSelectedTemplateId(template.id);
    setName(template.name);
    setType(template.type);
    setSpeedLimitKph(template.speedLimitKph);
    handlePointsChange(template.points);
  };

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

  useEffect(() => {
    if (zonesQuery.data?.data) {
      if (page === 1) {
        setAccumulatedZones(zonesQuery.data.data);
      } else {
        setAccumulatedZones((prev) => {
          const existingIds = new Set(prev.map((z) => z.id));
          const newZones = (zonesQuery.data?.data ?? []).filter((z) => !existingIds.has(z.id));
          return [...prev, ...newZones];
        });
      }
    }
  }, [zonesQuery.data, page]);

  const liveBikesQuery = useQuery({
    queryKey: ['live-bikes'],
    queryFn: () => apiFetch<PaginatedResponse<LiveBikeState>>('/live/bikes?page=1&pageSize=100'),
    retry: false,
  });

  const bikesQuery = useQuery({
    queryKey: ['bikes'],
    queryFn: () => apiFetch<PaginatedResponse<Bike>>('/bikes?page=1&pageSize=100'),
    retry: false,
  });

  const editingZone = useMemo(
    () => accumulatedZones.find((zone) => zone.id === editingZoneId) ?? null,
    [editingZoneId, accumulatedZones],
  );

  const zoneStats = useMemo(() => {
    const zones = accumulatedZones;
    return {
      total: zonesQuery.data?.total ?? 0,
      active: zones.filter((zone) => zone.active).length,
      slow: zones.filter((zone) => zone.type === 'SLOW').length,
      restricted: zones.filter((zone) => zone.type === 'NO_GO').length,
    };
  }, [accumulatedZones, zonesQuery.data?.total]);

  // Resets the fallback GeoJSON editor to a clean default state.
  const resetForm = () => {
    setEditingZoneId(null);
    setSelectedTemplateId(null);
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
      setFormError(t('Speed limit must be a valid number'));
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
      setFormError(t(parsedForm.error.issues[0]?.message ?? 'Invalid form'));
      return;
    }

    let parsedPolygon: unknown;
    try {
      parsedPolygon = JSON.parse(parsedForm.data.geojsonPolygon);
    } catch {
      setFormError(t('GeoJSON must be valid JSON'));
      return;
    }

    if (parsedForm.data.type === 'SLOW' && (!maybeSpeedLimit || maybeSpeedLimit <= 0)) {
      setFormError(t('Slow-speed zones require a positive speed limit.'));
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
      setPage(1);
      setAccumulatedZones([]);
      resetForm();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setFormError(t(error.message));
      } else {
        setFormError(t('Unable to save zone'));
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
      setPage(1);
      setAccumulatedZones([]);
      if (editingZoneId === deleteTarget.id) {
        resetForm();
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setFormError(t(error.message));
      } else {
        setFormError(t('Unable to delete zone'));
      }
    }
  };

  const columns = useMemo<Array<DataTableColumn<Zone>>>(
    () => [
      {
        header: t('Zone'),
        render: (zone) => (
          <div>
            <p className="font-semibold text-ink">{zone.name}</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{t(formatEnumLabel(zone.type))}</p>
          </div>
        ),
      },
      {
        header: t('Status'),
        render: (zone) => (
          <span
            className={
              zone.active
                ? 'inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
                : 'inline-flex rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft'
            }
          >
            {zone.active ? t('Active') : t('Inactive')}
          </span>
        ),
      },
      {
        header: t('Speed limit'),
        render: (zone) => (
          <span className="text-sm text-ink-soft">
            {zone.type === 'SLOW' ? `${zone.speedLimitKph ?? '--'} ${t('kph')}` : 'N/A'}
          </span>
        ),
      },
      {
        header: t('Action'),
        className: 'text-right',
        cellClassName: 'text-right',
        render: (zone) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => beginEditing(zone)}
              className="rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-hover"
            >
              {t('Edit')}
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(zone)}
              className="rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-strong"
              style={{ backgroundColor: '#E11D48', color: '#FFFFFF' }}
            >
              {t('Delete')}
            </button>
          </div>
        ),
      },
    ],
    [t],
  );

  if (currentUser && !isAdmin) {
    return (
      <div className="space-y-6">
        <DashboardCard eyebrow={t('Access')} title={t('Zone management is restricted')} description={t('This account cannot create, edit, or delete geofence policy boundaries.')}>
          <EmptyState
            icon={<ShieldCheck size={18} />}
            title={t('No zone-management access')}
            description={t('Switch to an admin account to manage slow, no-go, or parking boundaries.')}
          />
        </DashboardCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t('Total Zones')}
          value={String(zoneStats.total)}
          hint={t('All geofence zones registered for the fleet.')}
          icon={<MapPin size={18} />}
          tone="info"
        />
        <MetricCard
          title={t('Active')}
          value={String(zoneStats.active)}
          hint={t('Zones currently enforcing backend rules.')}
          icon={<ShieldCheck size={18} />}
          tone="success"
        />
        <MetricCard
          title={t('Slow Zones')}
          value={String(zoneStats.slow)}
          hint={t('Zones with an enforced speed limit.')}
          icon={<Plus size={18} />}
          tone="warning"
        />
        <MetricCard
          title={t('No-Go')}
          value={String(zoneStats.restricted)}
          hint={t('Restricted areas intended to trigger high-priority events.')}
          icon={<Trash2 size={18} />}
          tone="danger"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardCard eyebrow={t('Zone Registry')} title={t('Geofence list')} description={t('Edit fleet boundaries with safer inline actions and a clearer GeoJSON fallback view.')}>
          <div className="mt-1">
            <DataTable
              data={accumulatedZones}
              columns={columns}
              keyExtractor={(zone) => zone.id}
              loading={zonesQuery.isLoading}
              emptyState={
                <EmptyState
                  icon={<MapPin size={18} />}
                  title={t('No zones yet')}
                  description={t('Create your first zone to begin enforcing slow, no-go, or park rules.')}
                />
              }
            />
          </div>

          {accumulatedZones.length < (zonesQuery.data?.total ?? 0) && (
            <div className="mt-6 flex justify-center border-t border-line pt-6">
              <button
                type="button"
                disabled={zonesQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {zonesQuery.isFetching ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : (
                  <ChevronDown size={16} className="animate-bounce" />
                )}
                {zonesQuery.isFetching ? t('Loading...') : t('Load more')}
              </button>
            </div>
          )}
          {accumulatedZones.length >= (zonesQuery.data?.total ?? 0) && (zonesQuery.data?.total ?? 0) > 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 mt-6 pt-6 border-t border-line">
              <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                <Check size={14} /> {t('All {total} zones loaded').replace('{total}', String(zonesQuery.data?.total ?? 0))}
              </p>
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          eyebrow={t('Zone Editor')}
          title={editingZone ? t('Editing {name}').replace('{name}', editingZone.name) : t('Create a zone')}
          description={t('Select a pre-configured Rwanda template below or draw a custom boundary on the map.')}
        >
          {/* Quick Preset Rwanda Zone Templates */}
          {!editingZoneId && (
            <div className="rounded-[18px] border border-line bg-surface-muted/60 p-3.5 space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent flex items-center gap-1.5">
                  <MapPin size={12} /> {t('Rwanda Geofence Templates')}
                </span>
                <span className="text-[10px] text-ink-muted">{t('Click to auto-fill boundary')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RWANDA_ZONE_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => applyTemplate(tmpl)}
                      title={tmpl.description}
                      className={cx(
                        'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all text-left flex items-center gap-1.5',
                        isSelected
                          ? 'border-accent bg-accent/15 text-accent shadow-sm'
                          : 'border-line bg-surface hover:border-line-hover text-ink-soft hover:text-ink',
                      )}
                    >
                      <span>{tmpl.name}</span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-surface-muted text-ink-muted border border-line/40">
                        {tmpl.type.replace('_', ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={submitForm}>
            <TextField
              label={t('Zone name')}
              placeholder={t('Downtown slow zone')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <SelectField
                label={t('Zone type')}
                value={type}
                onChange={(event) => setType(event.target.value as 'SLOW' | 'NO_GO' | 'PARK' | 'WORK_BOUNDARY')}
              >
                <option value="SLOW">{t('Slow')}</option>
                <option value="NO_GO">{t('No-go')}</option>
                <option value="PARK">{t('Park')}</option>
                <option value="WORK_BOUNDARY">{t('Work Boundary')}</option>
              </SelectField>

              <TextField
                label={t('Speed limit kph')}
                placeholder={type === 'SLOW' ? '20' : t('Not required')}
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
              {t('Zone is active')}
            </label>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">{t('Map Boundary Editor')}</label>
              <div className="text-[11px] text-zinc-500 mb-1 leading-relaxed">
                {t('Click on the map below to define geofence boundary corners. Connect at least 3 points to form a closed shape.')}
              </div>
              <ZoneDrawMap
                points={points}
                onChange={handlePointsChange}
                center={mapCenter}
                liveBikes={liveBikesQuery.data?.data}
                bikes={bikesQuery.data?.data}
              />
            </div>

            <details className="group border border-line bg-surface-muted rounded-xl">
              <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-xs font-semibold text-zinc-400 select-none">
                <span>{t('Advanced: Raw GeoJSON Coordinates')}</span>
                <span className="text-[10px] text-zinc-500 group-open:hidden">{t('Show')}</span>
                <span className="text-[10px] text-zinc-500 hidden group-open:inline">{t('Hide')}</span>
              </summary>
              <div className="px-4 pb-4 border-t border-line/5 pt-3">
                <TextAreaField
                  label=""
                  hint={t('GeoJSON Polygon string')}
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
                {t('Reset form')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-[var(--radius-control)] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
              >
                {isSubmitting
                  ? editingZone
                    ? t('Saving zone...')
                    : t('Creating zone...')
                  : editingZone
                    ? t('Save zone changes')
                    : t('Create zone')}
              </button>
            </div>
          </form>
        </DashboardCard>
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title={t('Delete zone')}
        description={
          deleteTarget
            ? t('Delete {name}? This removes the zone from fleet policy enforcement.').replace('{name}', deleteTarget.name)
            : ''
        }
        confirmLabel={t('Delete zone')}
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void deleteZone();
        }}
      />
    </div>
  );
}

