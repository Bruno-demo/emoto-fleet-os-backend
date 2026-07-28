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
  // ─── Greater Kigali full administrative perimeter (Nyarugenge + Gasabo + Kicukiro) ───
  {
    id: 'kigali-city-boundary',
    name: 'Greater Kigali Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Full Kigali metropolitan perimeter — all 35 sectors across Nyarugenge, Gasabo & Kicukiro (~730 km²)',
    points: [
      // Northern tip (Gasabo — Bumbogo / Jabana)
      [29.995, -1.847],
      [30.035, -1.852],
      [30.082, -1.855],
      [30.130, -1.862],
      [30.175, -1.870],
      // Eastern edge (Gasabo — Ndera / Rusororo → Kicukiro — Kanombe)
      [30.210, -1.895],
      [30.225, -1.930],
      [30.220, -1.968],
      [30.210, -2.005],
      // Southeast corner (Kicukiro — Gahanga / Masaka)
      [30.195, -2.038],
      [30.165, -2.062],
      [30.130, -2.075],
      [30.095, -2.082],
      // Southern edge (Kicukiro / Nyarugenge border)
      [30.055, -2.078],
      [30.020, -2.068],
      // Southwest corner (Nyarugenge — Mageragere / Nyamirambo)
      [29.990, -2.048],
      [29.975, -2.020],
      // Western edge (Nyarugenge — Rwezamenyo / Nyakabanda → Gasabo — Kinyinya)
      [29.978, -1.985],
      [29.980, -1.952],
      [29.982, -1.925],
      [29.985, -1.895],
      [29.990, -1.865],
    ],
  },
  // ─── Core Kigali slow / no-go / park zones ───
  {
    id: 'kn-cbd',
    name: 'KN City Centre (CBD)',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Kigali central business district — Muhima, Nyarugenge, Gitega (25 kph)',
    points: [
      [30.050, -1.940],
      [30.072, -1.940],
      [30.072, -1.960],
      [30.050, -1.960],
    ],
  },
  {
    id: 'nyabugogo-terminal',
    name: 'Nyabugogo Bus Terminal',
    type: 'SLOW',
    speedLimitKph: '15',
    description: 'High-density passenger terminal & congestion zone (15 kph)',
    points: [
      [30.040, -1.935],
      [30.056, -1.935],
      [30.056, -1.949],
      [30.040, -1.949],
    ],
  },
  {
    id: 'kacyiru-diplomatic',
    name: 'Kacyiru Ministry Quarter',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Government & diplomatic quarter — ministries, embassies (25 kph)',
    points: [
      [30.076, -1.930],
      [30.098, -1.930],
      [30.098, -1.948],
      [30.076, -1.948],
    ],
  },
  {
    id: 'gikondo-industrial',
    name: 'Gikondo Industrial Area',
    type: 'SLOW',
    speedLimitKph: '30',
    description: 'Heavy-vehicle industrial district — warehouses & factories (30 kph)',
    points: [
      [30.062, -1.960],
      [30.085, -1.960],
      [30.085, -1.980],
      [30.062, -1.980],
    ],
  },
  {
    id: 'nyamirambo-market',
    name: 'Nyamirambo Commercial Hub',
    type: 'SLOW',
    speedLimitKph: '20',
    description: 'Dense market & residential area — narrow streets (20 kph)',
    points: [
      [30.035, -1.965],
      [30.055, -1.965],
      [30.055, -1.985],
      [30.035, -1.985],
    ],
  },
  {
    id: 'kimironko-market',
    name: 'Kimironko Commercial Market',
    type: 'PARK',
    speedLimitKph: '',
    description: 'Rider parking, charging & delivery staging area',
    points: [
      [30.118, -1.944],
      [30.138, -1.944],
      [30.138, -1.960],
      [30.118, -1.960],
    ],
  },
  {
    id: 'remera-it-hub',
    name: 'Remera / Kisimenti Hub',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Tech hub, restaurants & nightlife corridor (25 kph)',
    points: [
      [30.098, -1.948],
      [30.118, -1.948],
      [30.118, -1.965],
      [30.098, -1.965],
    ],
  },
  {
    id: 'kanombe-airport',
    name: 'Kigali International Airport Zone',
    type: 'NO_GO',
    speedLimitKph: '',
    description: 'Airport restricted perimeter — no unauthorized e-bike access',
    points: [
      [30.130, -1.958],
      [30.170, -1.958],
      [30.170, -1.985],
      [30.130, -1.985],
    ],
  },
  {
    id: 'gahanga-southern',
    name: 'Gahanga Southern Sector',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Southern Kicukiro expansion zone — new developments & farmland',
    points: [
      [30.068, -2.030],
      [30.135, -2.030],
      [30.135, -2.075],
      [30.068, -2.075],
    ],
  },
  {
    id: 'jabana-northern',
    name: 'Jabana / Bumbogo Northern Sector',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Northern Gasabo expansion zone — Jabana, Bumbogo & Rutunga sectors',
    points: [
      [30.000, -1.850],
      [30.095, -1.850],
      [30.095, -1.895],
      [30.000, -1.895],
    ],
  },
  {
    id: 'kicukiro-centre',
    name: 'Kicukiro Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Kicukiro district centre — schools, markets & residential (25 kph)',
    points: [
      [30.072, -1.985],
      [30.098, -1.985],
      [30.098, -2.010],
      [30.072, -2.010],
    ],
  },
  {
    id: 'ndera-eastern',
    name: 'Ndera / Rusororo Eastern Sector',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Eastern Gasabo expansion zone — Ndera hills & Rusororo plateau',
    points: [
      [30.160, -1.870],
      [30.225, -1.870],
      [30.225, -1.935],
      [30.160, -1.935],
    ],
  },
  // ─── External hubs (outside Kigali proper) ───
  {
    id: 'ksez-masoro',
    name: 'Kigali Special Economic Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Masoro industrial park & logistics warehousing hub',
    points: [
      [30.148, -1.960],
      [30.172, -1.960],
      [30.172, -1.980],
      [30.148, -1.980],
    ],
  },
  {
    id: 'bugesera-corridor',
    name: 'Bugesera Airport Corridor',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Southern transit corridor to Nyamata & Bugesera International Airport',
    points: [
      [30.050, -2.085],
      [30.165, -2.085],
      [30.165, -2.220],
      [30.050, -2.220],
    ],
  },
  // ─── Musanze (Northern Province) ───
  {
    id: 'musanze-hub',
    name: 'Musanze City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Musanze (Ruhengeri) metropolitan perimeter — Muhoza sector & tourism gateway',
    points: [
      [29.590, -1.470],
      [29.680, -1.470],
      [29.680, -1.535],
      [29.590, -1.535],
    ],
  },
  {
    id: 'musanze-centre',
    name: 'Musanze Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Musanze central commercial area — markets, bus park & main streets (25 kph)',
    points: [
      [29.620, -1.490],
      [29.650, -1.490],
      [29.650, -1.510],
      [29.620, -1.510],
    ],
  },
  {
    id: 'volcanoes-park-nogo',
    name: 'Volcanoes National Park',
    type: 'NO_GO',
    speedLimitKph: '',
    description: 'Protected gorilla habitat — no motorized vehicle access',
    points: [
      [29.380, -1.380],
      [29.680, -1.380],
      [29.680, -1.460],
      [29.380, -1.460],
    ],
  },
  // ─── Rubavu (Western Province — Lake Kivu) ───
  {
    id: 'rubavu-hub',
    name: 'Rubavu City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Rubavu (Gisenyi) metropolitan perimeter — lakefront, border & commercial zones',
    points: [
      [29.215, -1.670],
      [29.300, -1.670],
      [29.300, -1.740],
      [29.215, -1.740],
    ],
  },
  {
    id: 'rubavu-centre',
    name: 'Gisenyi Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Gisenyi commercial centre — DRC border crossing, market & lakefront (25 kph)',
    points: [
      [29.235, -1.690],
      [29.270, -1.690],
      [29.270, -1.715],
      [29.235, -1.715],
    ],
  },
  // ─── Huye (Southern Province) ───
  {
    id: 'huye-hub',
    name: 'Huye City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Huye (Butare) metropolitan perimeter — University of Rwanda, National Museum & commercial area',
    points: [
      [29.710, -2.570],
      [29.790, -2.570],
      [29.790, -2.640],
      [29.710, -2.640],
    ],
  },
  {
    id: 'huye-centre',
    name: 'Huye Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Huye central market, university campus & main avenue (25 kph)',
    points: [
      [29.730, -2.590],
      [29.760, -2.590],
      [29.760, -2.615],
      [29.730, -2.615],
    ],
  },
  // ─── Muhanga (Southern Province) ───
  {
    id: 'muhanga-hub',
    name: 'Muhanga City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Muhanga (Gitarama) metropolitan perimeter — Kigali–Huye transit hub & district capital',
    points: [
      [29.720, -2.055],
      [29.800, -2.055],
      [29.800, -2.115],
      [29.720, -2.115],
    ],
  },
  {
    id: 'muhanga-centre',
    name: 'Muhanga Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Muhanga commercial centre — main market & bus terminal (25 kph)',
    points: [
      [29.740, -2.072],
      [29.770, -2.072],
      [29.770, -2.095],
      [29.740, -2.095],
    ],
  },
  // ─── Rusizi (Western Province — DRC border) ───
  {
    id: 'rusizi-hub',
    name: 'Rusizi City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Rusizi (Cyangugu) metropolitan perimeter — Kamembe airport, DRC border & lakefront',
    points: [
      [28.870, -2.455],
      [28.945, -2.455],
      [28.945, -2.520],
      [28.870, -2.520],
    ],
  },
  {
    id: 'rusizi-centre',
    name: 'Kamembe Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Kamembe commercial hub — airport road, market & DRC crossing (25 kph)',
    points: [
      [28.890, -2.470],
      [28.920, -2.470],
      [28.920, -2.498],
      [28.890, -2.498],
    ],
  },
  // ─── Rwamagana (Eastern Province) ───
  {
    id: 'rwamagana-hub',
    name: 'Rwamagana City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Rwamagana metropolitan perimeter — Eastern Province capital & logistics corridor',
    points: [
      [30.400, -1.920],
      [30.475, -1.920],
      [30.475, -1.980],
      [30.400, -1.980],
    ],
  },
  {
    id: 'rwamagana-centre',
    name: 'Rwamagana Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Rwamagana commercial district — main market & RN3 highway junction (25 kph)',
    points: [
      [30.420, -1.938],
      [30.450, -1.938],
      [30.450, -1.960],
      [30.420, -1.960],
    ],
  },
  // ─── Nyagatare (Eastern Province — Northeast) ───
  {
    id: 'nyagatare-hub',
    name: 'Nyagatare City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Nyagatare metropolitan perimeter — northeast commercial hub & agribusiness centre',
    points: [
      [30.290, -1.265],
      [30.365, -1.265],
      [30.365, -1.325],
      [30.290, -1.325],
    ],
  },
  {
    id: 'nyagatare-centre',
    name: 'Nyagatare Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Nyagatare main market, bus park & commercial streets (25 kph)',
    points: [
      [30.310, -1.282],
      [30.340, -1.282],
      [30.340, -1.305],
      [30.310, -1.305],
    ],
  },
  // ─── Karongi / Kibuye (Western Province — Lake Kivu) ───
  {
    id: 'karongi-hub',
    name: 'Karongi City Operating Zone',
    type: 'WORK_BOUNDARY',
    speedLimitKph: '',
    description: 'Karongi (Kibuye) metropolitan perimeter — Lake Kivu shore, tourism & district capital',
    points: [
      [29.315, -2.035],
      [29.385, -2.035],
      [29.385, -2.095],
      [29.315, -2.095],
    ],
  },
  {
    id: 'karongi-centre',
    name: 'Kibuye Town Centre',
    type: 'SLOW',
    speedLimitKph: '25',
    description: 'Kibuye lakefront commercial area — hotels, market & harbour (25 kph)',
    points: [
      [29.335, -2.050],
      [29.365, -2.050],
      [29.365, -2.075],
      [29.335, -2.075],
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
        className: 'min-w-[220px]',
        cellClassName: 'min-w-[220px]',
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
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink text-sm truncate max-w-[260px]" title={zone.name}>{zone.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted flex items-center gap-1.5 font-medium whitespace-nowrap">
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
        className: 'w-32 whitespace-nowrap',
        cellClassName: 'w-32 whitespace-nowrap',
        render: (zone) => (
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap',
              zone.active
                ? 'bg-success-soft text-success-ink border border-success-ink/20 shadow-xs'
                : 'bg-surface-muted text-ink-muted border border-line'
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full shrink-0', zone.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
            {zone.active ? t('Active') : t('Inactive')}
          </span>
        ),
      },
      {
        header: t('Speed limit'),
        className: 'w-32 whitespace-nowrap',
        cellClassName: 'w-32 whitespace-nowrap',
        render: (zone) => (
          <span className="font-mono text-xs font-bold text-ink-soft whitespace-nowrap">
            {zone.type === 'SLOW' ? `${zone.speedLimitKph ?? '--'} ${t('kph')}` : 'N/A'}
          </span>
        ),
      },
      {
        header: t('Action'),
        className: 'w-40 text-right whitespace-nowrap',
        cellClassName: 'w-40 text-right whitespace-nowrap',
        render: (zone) => (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <button
              type="button"
              onClick={() => beginEditing(zone)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-surface-hover hover:border-line-strong cursor-pointer shadow-xs active:scale-95"
            >
              {t('Edit')}
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(zone)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-500 transition hover:bg-rose-500/20 cursor-pointer shadow-xs active:scale-95"
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
      <section className="grid gap-6 xl:grid-cols-12 items-start">
        {/* Geofence List */}
        <div className="xl:col-span-7 2xl:col-span-7">
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
              <div className="mt-6 pt-4 border-t border-line/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
                <div className="flex items-center gap-2 font-medium">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <Check size={14} /> {t('All {total} zones loaded').replace('{total}', String(zonesQuery.data?.total ?? 0))}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-faint">
                  <span className="bg-surface-muted border border-line px-2 py-0.5 rounded-lg">{zoneStats.active} Active</span>
                  <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-lg">{zoneStats.slow} Slow</span>
                  <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-lg">{zoneStats.restricted} No-Go</span>
                </div>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Zone Editor Form */}
        <div className="xl:col-span-5 2xl:col-span-5">
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
        </div>
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
