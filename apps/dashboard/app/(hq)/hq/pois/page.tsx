'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { MapPin, Search, Plus, Trash2, Edit, X, Phone, Check } from 'lucide-react';
import { useState } from 'react';

// Zod schemas for POIs
const poiSchema = z.object({
  id: z.string(),
  fleetId: z.string().nullable(),
  type: z.enum(['GARAGE', 'SWAP', 'CLINIC', 'OTHER']),
  name: z.string(),
  phone: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  supportedBikeTypes: z.array(z.string()).default([]),
  fullSwapFeeRwf: z.number().nullable().optional(),
  halfSwapFeeRwf: z.number().nullable().optional(),
  quarterSwapFeeRwf: z.number().nullable().optional(),
});

const poisResponseSchema = z.object({
  data: z.array(poiSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

const POI_TYPES = ['GARAGE', 'SWAP', 'CLINIC', 'OTHER'] as const;
const POI_ICONS = {
  GARAGE: '🔧',
  SWAP: '🔋',
  CLINIC: '🏥',
  OTHER: '📍',
};

export default function HqPoisPage() {
  const queryClient = useQueryClient();
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [page, setPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPoiId, setEditPoiId] = useState<string | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'GARAGE' | 'SWAP' | 'CLINIC' | 'OTHER'>('GARAGE');
  const [formPhone, setFormPhone] = useState('');
  const [formLat, setFormLat] = useState('-1.9441');
  const [formLng, setFormLng] = useState('30.0619');
  const [formAddress, setFormAddress] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formGlobal, setFormGlobal] = useState(true);
  const [formSupportedBikeTypes, setFormSupportedBikeTypes] = useState<string[]>([]);
  const [formFullSwapFee, setFormFullSwapFee] = useState('2500');
  const [formHalfSwapFee, setFormHalfSwapFee] = useState('1250');
  const [formQuarterSwapFee, setFormQuarterSwapFee] = useState('625');
  const [formError, setFormError] = useState<string | null>(null);

  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '50'); // Pull 50 items so client searching is extensive
  if (filterType) queryParams.set('type', filterType);
  if (filterActive !== '') queryParams.set('active', filterActive);

  // Fetch POIs
  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'pois', page, filterType, filterActive],
    queryFn: () => apiFetch(`/poi?${queryParams.toString()}`, {}, { schema: poisResponseSchema }),
  });

  // Create POI Mutation
  const createMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch('/poi', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'pois'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setFormError(error?.message ?? 'Failed to create help point');
    },
  });

  // Update POI Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      apiFetch(`/poi/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'pois'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setFormError(error?.message ?? 'Failed to update help point');
    },
  });

  // Delete POI Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/poi/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'pois'] });
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      alert(error?.message ?? 'Failed to delete help point');
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditPoiId(null);
    setFormName('');
    setFormType('GARAGE');
    setFormPhone('');
    setFormLat('-1.9441');
    setFormLng('30.0619');
    setFormAddress('');
    setFormActive(true);
    setFormGlobal(true);
    setFormSupportedBikeTypes([]);
    setFormFullSwapFee('2500');
    setFormHalfSwapFee('1250');
    setFormQuarterSwapFee('625');
    setFormError(null);
  };

  const openAddModal = () => {
    closeModal();
    setIsModalOpen(true);
  };

  const openEditModal = (poi: z.infer<typeof poiSchema>) => {
    setEditPoiId(poi.id);
    setFormName(poi.name);
    setFormType(poi.type);
    setFormPhone(poi.phone ?? '');
    setFormLat(String(poi.lat));
    setFormLng(String(poi.lng));
    setFormAddress(poi.address ?? '');
    setFormActive(poi.active);
    setFormGlobal(poi.fleetId === null);
    setFormSupportedBikeTypes(poi.supportedBikeTypes || []);
    setFormFullSwapFee(String(poi.fullSwapFeeRwf ?? 2500));
    setFormHalfSwapFee(String(poi.halfSwapFeeRwf ?? 1250));
    setFormQuarterSwapFee(String(poi.quarterSwapFeeRwf ?? 625));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const latNum = parseFloat(formLat);
    const lngNum = parseFloat(formLng);

    if (!formName.trim()) {
      setFormError('Name is required');
      return;
    }
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError('Latitude must be a valid number between -90 and 90');
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setFormError('Longitude must be a valid number between -180 and 180');
      return;
    }

    const payload = {
      name: formName.trim(),
      type: formType,
      phone: formPhone.trim() || null,
      lat: latNum,
      lng: lngNum,
      address: formAddress.trim() || null,
      active: formActive,
      global: formGlobal,
      supportedBikeTypes: formSupportedBikeTypes,
      fullSwapFeeRwf: formType === 'SWAP' ? (parseInt(formFullSwapFee) || 2500) : null,
      halfSwapFeeRwf: formType === 'SWAP' ? (parseInt(formHalfSwapFee) || 1250) : null,
      quarterSwapFeeRwf: formType === 'SWAP' ? (parseInt(formQuarterSwapFee) || 625) : null,
    };

    if (editPoiId) {
      updateMutation.mutate({ id: editPoiId, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete help point "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Client-side search filtering
  const filteredPois = (data?.data ?? []).filter((poi) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      poi.name.toLowerCase().includes(query) ||
      (poi.address && poi.address.toLowerCase().includes(query)) ||
      poi.type.toLowerCase().includes(query)
    );
  }) ?? [];

  const stats = {
    total: data?.total ?? 0,
    garages: (data?.data ?? []).filter(p => p.type === 'GARAGE').length ?? 0,
    swaps: (data?.data ?? []).filter(p => p.type === 'SWAP').length ?? 0,
    clinics: (data?.data ?? []).filter(p => p.type === 'CLINIC').length ?? 0,
  };

  const typeColor = (t: string) => {
    if (t === 'GARAGE') return 'bg-indigo-400/15 text-indigo-400 border-indigo-400/20';
    if (t === 'SWAP') return 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20';
    if (t === 'CLINIC') return 'bg-rose-400/15 text-rose-400 border-rose-400/20';
    return 'bg-violet-400/15 text-violet-400 border-violet-400/20';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Help Points (POIs)</h1>
          <p className="mt-1 text-zinc-400">Manage garages, battery swap points, and clinic facilities displayed in the ecosystem.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={openAddModal}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white hover:brightness-110 transition-all shadow-md shadow-accent/10"
          >
            <Plus size={16} />
            Add Help Point
          </button>
          <div className="text-sm font-bold text-zinc-500 self-center">
            {data ? `${data.total.toLocaleString()} registered points` : '…'}
          </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.06] bg-surface-strong/50 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-400">
            <MapPin size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Points</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-indigo-500/[0.03] p-5 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-400">
            <span className="text-lg">🔧</span>
            <span className="text-xs font-semibold uppercase tracking-wider">Active Garages</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-indigo-400">{stats.garages}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-emerald-500/[0.03] p-5 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-400">
            <span className="text-lg">🔋</span>
            <span className="text-xs font-semibold uppercase tracking-wider">Active Swaps</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-400">{stats.swaps}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-rose-500/[0.03] p-5 shadow-sm">
          <div className="flex items-center gap-3 text-rose-400">
            <span className="text-lg">🏥</span>
            <span className="text-xs font-semibold uppercase tracking-wider">Active Clinics</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-rose-400">{stats.clinics}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative group flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-accent transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search by name, address, or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-surface-strong pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-zinc-400 focus:border-accent focus:outline-none"
        >
          <option value="">All Help Types</option>
          {POI_TYPES.map(t => <option key={t} value={t}>{POI_ICONS[t]} {t}</option>)}
        </select>
        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-zinc-400 focus:border-accent focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {/* Main Table */}
      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Name & Type</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Phone</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Address</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Coordinates</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Visibility</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-6">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : filteredPois.length === 0 ? (
                <tr key="empty">
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                      <MapPin size={20} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-400">No help points found</p>
                    <p className="mt-1 text-xs text-zinc-600">Register new garages, battery swaps, or clinics in the region.</p>
                  </td>
                </tr>
              ) : (
                filteredPois.map((poi) => (
                  <tr key={poi.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span className="text-xl flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                          {POI_ICONS[poi.type]}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{poi.name}</p>
                          <div className="flex flex-wrap gap-1.5 items-center mt-1">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold ${typeColor(poi.type)}`}>
                              {poi.type}
                            </span>
                            {poi.type === 'SWAP' && (
                              <span className="text-[10px] font-semibold text-amber-400">
                                Fees: {(poi.fullSwapFeeRwf ?? 2500).toLocaleString()} / {(poi.halfSwapFeeRwf ?? 1250).toLocaleString()} / {(poi.quarterSwapFeeRwf ?? 625).toLocaleString()} RWF
                              </span>
                            )}
                            {poi.supportedBikeTypes?.map((bt) => (
                              <span key={bt} className="inline-flex items-center rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-zinc-400">
                                {bt}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {poi.phone ? (
                        <a href={`tel:${poi.phone}`} className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium">
                          <Phone size={11} />
                          {poi.phone}
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-300 font-medium max-w-[200px] block truncate" title={poi.address ?? ''}>
                        {poi.address ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-400 font-mono">
                        {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {poi.fleetId === null ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
                          <Check size={12} className="stroke-[3]" /> Global
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500">
                          Fleet-Only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${poi.active ? 'bg-emerald-400/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                        {poi.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(poi)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                          title="Edit point"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(poi.id, poi.name)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger-line/20 bg-danger-ink/5 text-danger-ink transition hover:bg-danger-ink/10"
                          title="Delete point"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-line bg-[#09090b] p-6 shadow-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-white">{editPoiId ? 'Edit Help Point' : 'Register New Help Point'}</h2>
            <p className="mt-1 text-sm text-zinc-400">Configure global support points for rider networks.</p>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-xl bg-danger-ink/10 border border-danger-line/20 p-3 text-xs text-danger-ink">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kigali Central Swap Station"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'GARAGE' | 'SWAP' | 'CLINIC' | 'OTHER')}
                    className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-zinc-400 focus:border-accent focus:outline-none"
                  >
                    <option value="GARAGE">🔧 Garage</option>
                    {/* <option value="SWAP">🔋 Battery Swap</option> */}
                    <option value="CLINIC">🏥 Clinic</option>
                    <option value="OTHER">📍 Other Location</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +250 788 000 111"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Latitude</label>
                  <input
                    type="text"
                    required
                    placeholder="-1.9441"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Longitude</label>
                  <input
                    type="text"
                    required
                    placeholder="30.0619"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. KN 3 Road, Gikondo"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                />
              </div>

              {formType === 'SWAP' && (
                <div className="rounded-xl border border-line bg-surface-strong/50 p-4 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Swap Station Fees (RWF)</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-500 mb-1">Full Swap</label>
                      <input
                        type="number"
                        required
                        value={formFullSwapFee}
                        onChange={(e) => setFormFullSwapFee(e.target.value)}
                        className="h-9 w-full rounded-lg border border-line bg-surface-strong px-2 text-xs text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-500 mb-1">Half Swap</label>
                      <input
                        type="number"
                        required
                        value={formHalfSwapFee}
                        onChange={(e) => setFormHalfSwapFee(e.target.value)}
                        className="h-9 w-full rounded-lg border border-line bg-surface-strong px-2 text-xs text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-500 mb-1">Quarter Swap</label>
                      <input
                        type="number"
                        required
                        value={formQuarterSwapFee}
                        onChange={(e) => setFormQuarterSwapFee(e.target.value)}
                        className="h-9 w-full rounded-lg border border-line bg-surface-strong px-2 text-xs text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Supported Bike Models</label>
                <div className="flex gap-4">
                  {['SPIRO', 'AMPARSAND', 'AMAZI'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSupportedBikeTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormSupportedBikeTypes([...formSupportedBikeTypes, type]);
                          } else {
                            setFormSupportedBikeTypes(formSupportedBikeTypes.filter((t) => t !== type));
                          }
                        }}
                        className="h-4 w-4 rounded border-line bg-surface-strong text-accent focus:ring-accent"
                      />
                      <span className="text-xs font-bold text-white">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formGlobal}
                    onChange={(e) => setFormGlobal(e.target.checked)}
                    className="h-4 w-4 rounded border-line bg-surface-strong text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">Global Visibility</p>
                    <p className="text-[10px] text-zinc-500">Enable this point across all ecosystem fleets.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="h-4 w-4 rounded border-line bg-surface-strong text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">Active Status</p>
                    <p className="text-[10px] text-zinc-500">Render point on rider mobile apps and maps.</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 rounded-xl border border-line px-4 text-xs font-bold text-zinc-400 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex h-10 items-center justify-center rounded-xl bg-accent px-5 text-xs font-bold text-white hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editPoiId ? 'Update Point' : 'Create Point'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
