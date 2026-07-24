'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  ChevronDown,
  Check,
  Zap,
  ShieldAlert,
  ParkingSquare,
  Compass,
  RotateCcw,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';
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
import { InlineNotice, TextAreaField, TextField } from '@/components/ui/form-controls';

import { useTranslation } from '@/components/i18n/LanguageProvider';
import { SubscriptionGate } from '@/components/subscription-gate';
import { canUseFeature } from '@/lib/subscription';

function LoadingDrawingCanvas() {
  const { t } = useTranslation();
  return (
    <div className="h-80 w-full rounded-2xl border border-line bg-surface-muted/50 flex flex-col items-center justify-center gap-2 text-xs text-ink-soft animate-pulse">
      <Compass size={24} className="animate-spin text-accent" />
      <span>{t('Loading interactive geofence canvas...')}</span>
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
    name: 'Kigali Special Economic Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Masoro industrial park & logistics warehousing hub',
    points: [
      [30.150, -1.962],
      [30.168, -1.962],
      [30.168, -1.978],
      [30.150, -1.978],
    ],
  },
  {
    id: 'nyabugogo-terminal',
    name: 'Nyabugogo Bus Terminal',
    type: 'SLOW',
    speedLimitKph: '15',
    description: 'High-density passenger terminal & congestion zone (15 kph)',
    points: [
      [30.042, -1.936],
      [30.054, -1.936],
      [30.054, -1.948],
      [30.042, -1.948],
    ],
  },
  {
    id: 'kacyiru-diplomatic',
    name: 'Kacyiru Ministry Quarter',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'High-security administrative district (25 kph)',
    points: [
      [30.076, -1.932],
      [30.095, -1.932],
      [30.095, -1.949],
      [30.076, -1.949],
    ],
  },
  {
    id: 'kimironko-market',
    name: 'Kimironko Commercial Market',
    type: 'PARK',
    speedLimitKph: '',
    description: 'Rider parking, charging & delivery staging area',
    points: [
      [30.122, -1.947],
      [30.136, -1.947],
      [30.136, -1.959],
      [30.122, -1.959],
    ],
  },
  {
    id: 'bugesera-corridor',
    name: 'Bugesera Airport Corridor',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Southern transit corridor to Nyamata & Bugesera',
    points: [
      [30.082, -2.045],
      [30.145, -2.045],
      [30.145, -2.185],
      [30.082, -2.185],
    ],
  },
  {
    id: 'musanze-hub',
    name: 'Musanze Logistics Hub',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Northern Province operating perimeter & tourism hub',
    points: [
      [29.605, -1.475],
      [29.665, -1.475],
      [29.665, -1.535],
      [29.605, -1.535],
    ],
  },
  {
    id: 'rubavu-border',
    name: 'Rubavu Border Cross-Dock',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Western border logistics & lakefront cross-docking zone',
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
  const [speedLimitKph, setSpeedLimitKph] = useState('20');
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
    setSpeedLimitKph(template.speedLimitKph || (template.type === 'SLOW' ? '20' : ''));
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

  const canUseZones = canUseFeature(currentUser, 'zones');
  const isAdmin = currentUser ? canManageZones(currentUser.role) : false;

  const zonesQuery = useQuery({
    queryKey: ['zones', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Zone>>(
        `/zones${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
    enabled: isAdmin && canUseZones,
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
    enabled: canUseZones,
    retry: false,
  });

  const bikesQuery = useQuery({
    queryKey: ['bikes'],
    queryFn: () => apiFetch<PaginatedResponse<Bike>>('/bikes?page=1&pageSize=100'),
    enabled: canUseZones,
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

  // Resets the GeoJSON editor to a clean default state.
  const resetForm = () => {
    setEditingZoneId(null);
    setSelectedTemplateId(null);
    setName('');
    setType('SLOW');
    setSpeedLimitKph('20');
    setActive(true);
    setGeojsonPolygon(defaultPolygon);
    setPoints(defaultPoints);
    setFormError(null);
  };

  // Loads the selected zone into the form
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
      const cleanPoints = rawCoords.slice(0, -1);
      setPoints(cleanPoints);
    } else {
      setPoints([]);
    }
  };

  // Creates or updates a zone record
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
        render: (zone) => {
          let typeBadgeColor = 'bg-blue-500/15 text-blue-500 border-blue-500/30';
          let typeIcon = <Layers size={14} />;
          if (zone.type === 'SLOW') {
            typeBadgeColor = 'bg-amber-500/15 text-amber-500 border-amber-500/30';
            typeIcon = <Zap size={14} />;
          } else if (zone.type === 'NO_GO') {
            typeBadgeColor = 'bg-rose-500/15 text-rose-500 border-rose-500/30';
            typeIcon = <ShieldAlert size={14} />;
          } else if (zone.type === 'PARK') {
            typeBadgeColor = 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
            typeIcon = <ParkingSquare size={14} />;
          }

          return (
            <div className="flex items-center gap-3">
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-xs', typeBadgeColor)}>
                {typeIcon}
              </span>
              <div>
                <p className="font-bold text-ink text-sm">{zone.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted flex items-center gap-1.5 font-medium">
                  <span>{t(formatEnumLabel(zone.type))}</span>
                  {zone.type === 'SLOW' && zone.speedLimitKph && (
                    <span className="font-mono text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                      ⚡ {zone.speedLimitKph} kph
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        header: t('Status'),
        render: (zone) => (
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]',
              zone.active
                ? 'bg-success-soft text-success-ink border border-success-ink/20'
                : 'bg-surface-muted text-ink-muted border border-line'
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', zone.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
            {zone.active ? t('Active') : t('Inactive')}
          </span>
        ),
      },
      {
        header: t('Speed limit'),
        render: (zone) => (
          <span className="font-mono text-xs font-bold text-ink-soft">
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
              className="rounded-xl border border-line bg-surface-muted px-3.5 py-1.5 text-xs font-bold text-ink transition hover:bg-surface-hover hover:border-line-strong cursor-pointer"
            >
              {t('Edit')}
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(zone)}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-bold text-rose-500 transition hover:bg-rose-500/20 cursor-pointer"
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
    <SubscriptionGate>
      <div className="space-y-6">
      {/* Sleek Page Header Banner */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-xs">
              <Compass size={18} />
            </span>
            <h2 className="font-display text-xl font-bold text-ink">{t('Geofences & Safety Zones')}</h2>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            {t('Enforce speed limits, restricted no-go areas, and parking perimeters across Rwanda.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editingZoneId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-surface-hover cursor-pointer"
            >
              <RotateCcw size={14} />
              {t('Cancel Edit')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              resetForm();
              window.scrollTo({ top: 400, behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white hover:bg-accent-strong transition cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            {t('Create Zone')}
          </button>
        </div>
      </section>

      {/* Top Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t('Total Zones')}
          value={String(zoneStats.total)}
          hint={t('All geofence zones registered for the fleet.')}
          icon={<MapPin size={18} />}
          tone="info"
        />
        <MetricCard
          title={t('Active Enforced')}
          value={String(zoneStats.active)}
          hint={t('Zones currently enforcing backend rules.')}
          icon={<ShieldCheck size={18} />}
          tone="success"
        />
        <MetricCard
          title={t('Slow Speed Zones')}
          value={String(zoneStats.slow)}
          hint={t('Zones with an enforced speed limit.')}
          icon={<Zap size={18} />}
          tone="warning"
        />
        <MetricCard
          title={t('No-Go Restricted')}
          value={String(zoneStats.restricted)}
          hint={t('Restricted areas triggering security alerts.')}
          icon={<ShieldAlert size={18} />}
          tone="danger"
        />
      </section>

      {/* Rwanda Presets Gallery */}
      <DashboardCard
        eyebrow={t('Quick Setup')}
        title={t('Rwanda Geofence Presets')}
        description={t('Select a pre-configured boundary to auto-load coordinates directly onto the map and form.')}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          {RWANDA_ZONE_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplateId === tmpl.id;
            let typeBadgeColor = 'bg-blue-500/15 text-blue-500 border-blue-500/30';
            let typeIcon = <Layers size={12} />;
            if (tmpl.type === 'SLOW') {
              typeBadgeColor = 'bg-amber-500/15 text-amber-500 border-amber-500/30';
              typeIcon = <Zap size={12} />;
            } else if (tmpl.type === 'NO_GO') {
              typeBadgeColor = 'bg-rose-500/15 text-rose-500 border-rose-500/30';
              typeIcon = <ShieldAlert size={12} />;
            } else if (tmpl.type === 'PARK') {
              typeBadgeColor = 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
              typeIcon = <ParkingSquare size={12} />;
            }

            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className={cx(
                  'group flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer relative overflow-hidden',
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-md ring-1 ring-accent'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover hover:scale-[1.01]'
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={cx('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', typeBadgeColor)}>
                      {typeIcon}
                      <span>{t(tmpl.type.replace('_', ' '))}</span>
                    </span>
                    {tmpl.speedLimitKph && (
                      <span className="font-mono text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {tmpl.speedLimitKph} kph
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-ink text-xs group-hover:text-accent transition-colors">{tmpl.name}</h4>
                  <p className="text-[11px] text-ink-muted mt-1 leading-snug line-clamp-2">{tmpl.description}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-line/40 flex items-center justify-between text-[10px] text-ink-faint font-semibold">
                  <span>📍 {tmpl.points.length} points</span>
                  <span className="text-accent group-hover:underline flex items-center gap-0.5">
                    <Sparkles size={10} /> {t('Apply')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </DashboardCard>

      {/* Main Grid: Zone Registry + Zone Form Editor */}
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-start">
        {/* Geofence List */}
        <DashboardCard
          eyebrow={t('Zone Registry')}
          title={t('Geofence list')}
          description={t('View and manage active safety boundaries enforcing backend speed caps and security rules.')}
        >
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

        {/* Zone Editor Form */}
        <DashboardCard
          eyebrow={t('Zone Editor')}
          title={editingZone ? t('Editing {name}').replace('{name}', editingZone.name) : t('Create a zone')}
          description={t('Draw a boundary on the map or pick a preset above to define rules.')}
        >
          <form className="space-y-5" onSubmit={submitForm}>
            <TextField
              label={t('Zone name')}
              placeholder={t('Downtown slow zone')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            {/* Interactive Zone Type Selector Cards */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink">{t('Zone Type')}</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    key: 'SLOW',
                    label: t('Slow Zone'),
                    desc: t('Speed limit enforced'),
                    icon: <Zap size={16} />,
                    color: 'hover:border-amber-500/50',
                    activeColor: 'border-amber-500 bg-amber-500/10 text-amber-500',
                  },
                  {
                    key: 'NO_GO',
                    label: t('No-Go Area'),
                    desc: t('Restricted / Alerts'),
                    icon: <ShieldAlert size={16} />,
                    color: 'hover:border-rose-500/50',
                    activeColor: 'border-rose-500 bg-rose-500/10 text-rose-500',
                  },
                  {
                    key: 'PARK',
                    label: t('Park Hub'),
                    desc: t('Staging & Charging'),
                    icon: <ParkingSquare size={16} />,
                    color: 'hover:border-emerald-500/50',
                    activeColor: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
                  },
                  {
                    key: 'WORK_BOUNDARY',
                    label: t('Work Boundary'),
                    desc: t('Operating perimeter'),
                    icon: <Layers size={16} />,
                    color: 'hover:border-blue-500/50',
                    activeColor: 'border-blue-500 bg-blue-500/10 text-blue-500',
                  },
                ].map((item) => {
                  const isSelected = type === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const newType = item.key as 'SLOW' | 'NO_GO' | 'PARK' | 'WORK_BOUNDARY';
                        setType(newType);
                        if (newType === 'SLOW' && !speedLimitKph) {
                          setSpeedLimitKph('20');
                        }
                      }}
                      className={cx(
                        'flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer relative',
                        item.color,
                        isSelected
                          ? item.activeColor + ' ring-1 shadow-xs font-bold'
                          : 'border-line bg-surface-muted/50 text-ink-soft hover:bg-surface-hover'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {item.icon}
                        <span className="text-xs font-bold">{item.label}</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-normal">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speed Limit (Only active for SLOW zone) */}
            {type === 'SLOW' && (
              <div className="animate-fade-in">
                <TextField
                  label={t('Enforced Speed Limit (kph)')}
                  placeholder="20"
                  value={speedLimitKph}
                  onChange={(event) => setSpeedLimitKph(event.target.value)}
                />
              </div>
            )}

            {/* Active Toggle Switch */}
            <label className="flex items-center justify-between rounded-xl border border-line bg-surface-muted/50 px-4 py-3 text-xs font-bold text-ink cursor-pointer hover:bg-surface-hover transition-colors">
              <div className="flex items-center gap-2">
                <span className={cx('h-2.5 w-2.5 rounded-full', active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                <span>{t('Zone Enforcement Active')}</span>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent accent-accent cursor-pointer"
              />
            </label>

            {/* Map Boundary Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Sliders size={14} className="text-accent" />
                  {t('Map Boundary Editor')}
                </label>
                <span className="text-[10px] text-ink-muted">{t('Click to add points')}</span>
              </div>
              <ZoneDrawMap
                points={points}
                onChange={handlePointsChange}
                center={mapCenter}
                liveBikes={liveBikesQuery.data?.data}
                bikes={bikesQuery.data?.data}
                zoneType={type}
              />
            </div>

            {/* GeoJSON Fallback accordion */}
            <details className="group border border-line bg-surface-muted/40 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-4 py-2.5 text-xs font-semibold text-ink-muted hover:text-ink select-none transition-colors">
                <span>{t('Advanced: Raw GeoJSON Coordinates')}</span>
                <span className="text-[10px] text-ink-faint group-open:hidden">{t('Show')}</span>
                <span className="text-[10px] text-ink-faint hidden group-open:inline">{t('Hide')}</span>
              </summary>
              <div className="px-4 pb-4 border-t border-line/40 pt-3">
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

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-surface-hover cursor-pointer"
              >
                {t('Reset form')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 shadow-sm cursor-pointer"
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

      {/* Delete Confirmation Modal */}
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
    </SubscriptionGate>
  );
}
