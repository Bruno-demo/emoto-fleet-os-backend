'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Cpu, Search, Bike, X, Link2, Unlink, KeyRound, Plus, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const devicesResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      deviceUid: z.string(),
      imei: z.string().nullable(),
      status: z.string(),
      lastSeenAt: z.string().nullable(),
      fwVersion: z.string().nullable(),
      bikeId: z.string().nullable(),
      bike: z.object({ id: z.string(), label: z.string() }).nullable(),
      fleet: z.object({ id: z.string(), name: z.string() }),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

const fleetsListSchema = z.array(
  z.object({ id: z.string(), name: z.string() })
);

const fleetDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  bikes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      plate: z.string().nullable(),
      status: z.string(),
    })
  ),
});

const STATUSES = ['ACTIVE', 'INACTIVE', 'RETIRED'];

export default function HqDevicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFleetId, setFilterFleetId] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [page, setPage] = useState(1);

  // Assign modal state
  const [assignDeviceId, setAssignDeviceId] = useState<string | null>(null);
  const [assignFleetId, setAssignFleetId] = useState<string | null>(null);
  const [assignBikeId, setAssignBikeId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  // Add Device modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDeviceUid, setNewDeviceUid] = useState('');
  const [newImei, setNewImei] = useState('');
  const [newFleetId, setNewFleetId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // One-time secret display state
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [oneTimeSecretDeviceUid, setOneTimeSecretDeviceUid] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '25');
  if (search) queryParams.set('search', search);
  if (filterStatus) queryParams.set('status', filterStatus);
  if (filterFleetId) queryParams.set('fleetId', filterFleetId);
  if (filterAssigned) queryParams.set('assigned', filterAssigned);

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'devices', page, search, filterStatus, filterFleetId, filterAssigned],
    queryFn: () => apiFetch(`/hq/devices?${queryParams.toString()}`, {}, { schema: devicesResponseSchema }),
  });

  const { data: fleetsList } = useQuery({
    queryKey: ['hq', 'fleets-list'],
    queryFn: () => apiFetch('/hq/fleets?pageSize=200', {}).then((res) => {
      const r = res as { data?: Array<{ id: string; name: string }> };
      return (r.data ?? r) as Array<{ id: string; name: string }>;
    }),
  });

  // Fetch bikes for selected fleet when assigning
  const { data: fleetDetail } = useQuery({
    queryKey: ['hq', 'fleet', assignFleetId],
    queryFn: () => apiFetch(`/hq/fleets/${assignFleetId}`, {}, { schema: fleetDetailSchema }),
    enabled: !!assignFleetId,
  });

  const assignMutation = useMutation({
    mutationFn: ({ deviceId, bikeId }: { deviceId: string; bikeId: string }) =>
      apiFetch(`/hq/devices/${deviceId}/assign-bike`, {
        method: 'POST',
        body: JSON.stringify({ bikeId }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setAssignDeviceId(null);
      setAssignFleetId(null);
      setAssignBikeId('');
      setAssignError(null);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setAssignError(error?.message ?? 'Failed to assign device');
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(`/hq/devices/${deviceId}/unassign-bike`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
    },
  });

  const createDeviceMutation = useMutation({
    mutationFn: (body: { deviceUid: string; imei?: string; fleetId: string }) =>
      apiFetch('/hq/devices', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (res: unknown) => {
      const result = res as { deviceSecret: string; device: { deviceUid: string } };
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setIsAddModalOpen(false);
      setNewDeviceUid('');
      setNewImei('');
      setNewFleetId('');
      setAddError(null);
      setOneTimeSecret(result.deviceSecret);
      setOneTimeSecretDeviceUid(result.device.deviceUid);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setAddError(error?.message ?? 'Failed to provision device');
    },
  });

  const rotateSecretMutation = useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(`/hq/devices/${deviceId}/rotate-secret`, {
        method: 'POST',
      }),
    onSuccess: (res: unknown) => {
      const result = res as { deviceSecret: string; deviceUid: string };
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setOneTimeSecret(result.deviceSecret);
      setOneTimeSecretDeviceUid(result.deviceUid);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      alert(error?.message ?? 'Failed to rotate device secret');
    },
  });

  const statusColor = (s: string) => {
    if (s === 'ACTIVE') return 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20';
    if (s === 'INACTIVE') return 'bg-amber-400/15 text-amber-400 border-amber-400/20';
    if (s === 'RETIRED') return 'bg-rose-400/15 text-rose-400 border-rose-400/20';
    return 'bg-white/5 text-zinc-400 border-line';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Global Devices</h1>
          <p className="mt-1 text-zinc-400">View and manage all IoT tracker units across every fleet.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white hover:brightness-110 transition-all shadow-md shadow-accent/10"
          >
            <Plus size={16} />
            Add Device
          </button>
          <div className="text-sm font-bold text-zinc-500 self-center">
            {data ? `${data.total.toLocaleString()} total devices` : '…'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative group flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-accent transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search by device UID or IMEI…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-xl border border-line bg-surface-strong pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
        <select
          value={filterFleetId}
          onChange={(e) => { setFilterFleetId(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All fleets</option>
          {(fleetsList ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterAssigned}
          onChange={(e) => { setFilterAssigned(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All assignment</option>
          <option value="true">Assigned</option>
          <option value="false">Unassigned</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Device UID</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">IMEI</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Assigned Bike</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Last Seen</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">FW Version</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-6 py-6">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr key="empty">
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                      <Cpu size={20} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-400">No devices found</p>
                    <p className="mt-1 text-xs text-zinc-600">Adjust your filters or provision new devices.</p>
                  </td>
                </tr>
              ) : (
                data?.data.map((device) => (
                  <tr key={device.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-white">{device.deviceUid}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-400 font-mono">{device.imei ?? '—'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-medium text-ink-soft">{device.fleet.name}</span>
                    </td>
                    <td className="px-6 py-5">
                      {device.bike ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <Bike size={12} />
                          {device.bike.label}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${statusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-500">
                        {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-400 font-mono">{device.fwVersion ?? '—'}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to rotate the secret for device "${device.deviceUid}"? The existing secret will be immediately invalidated.`)) {
                              rotateSecretMutation.mutate(device.id);
                            }
                          }}
                          disabled={rotateSecretMutation.isPending}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[11px] font-bold text-zinc-300 hover:bg-white/10 transition-all disabled:opacity-50"
                          title="Rotate device secret"
                        >
                          <KeyRound size={12} />
                          Rotate Secret
                        </button>
                        {device.bike ? (
                          <button
                            onClick={() => {
                              if (confirm(`Unassign device "${device.deviceUid}" from bike "${device.bike?.label}"?`)) {
                                unassignMutation.mutate(device.id);
                              }
                            }}
                            disabled={unassignMutation.isPending}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 text-[11px] font-bold text-amber-400 hover:bg-amber-400/10 transition-all disabled:opacity-50"
                            title="Unassign bike"
                          >
                            <Unlink size={12} />
                            Unassign
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setAssignDeviceId(device.id);
                              setAssignFleetId(device.fleet.id);
                              setAssignBikeId('');
                              setAssignError(null);
                            }}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 text-[11px] font-bold text-accent hover:bg-accent/20 transition-all"
                            title="Assign to bike"
                          >
                            <Link2 size={12} />
                            Assign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-line bg-surface-strong px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded-xl border border-line bg-surface-strong px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
          >
            Next
          </button>
        </div>
      )}

      {/* Provision Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-line bg-[#09090b] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-white">Provision New Device</h2>
            <p className="mt-1 text-sm text-zinc-400">Register a new IoT tracker unit to a specific fleet.</p>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newDeviceUid.trim()) {
                  setAddError('Device UID is required');
                  return;
                }
                if (!newFleetId) {
                  setAddError('Fleet assignment is required');
                  return;
                }
                createDeviceMutation.mutate({
                  deviceUid: newDeviceUid.trim(),
                  imei: newImei.trim() || undefined,
                  fleetId: newFleetId,
                });
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Device UID</label>
                <input
                  type="text"
                  placeholder="e.g. EMOTO-DEV-201"
                  value={newDeviceUid}
                  onChange={(e) => setNewDeviceUid(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">IMEI (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 863219041234567"
                  value={newImei}
                  onChange={(e) => setNewImei(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Select Fleet</label>
                <select
                  value={newFleetId}
                  onChange={(e) => setNewFleetId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white outline-none transition focus:border-accent cursor-pointer"
                >
                  <option value="">— Select a fleet —</option>
                  {(fleetsList ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {addError && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{addError}</p>
              )}
              
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDeviceMutation.isPending}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {createDeviceMutation.isPending ? 'Provisioning…' : 'Provision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Secret Display Modal */}
      {oneTimeSecret && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-3xl border border-amber-500/20 bg-[#09090b] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
              <KeyRound size={24} />
            </div>
            
            <h2 className="text-lg font-bold text-center text-white">One-Time Device Secret</h2>
            <p className="mt-2 text-center text-xs text-zinc-400 leading-relaxed">
              Successfully generated secret for <strong className="text-zinc-200">{oneTimeSecretDeviceUid}</strong>.
            </p>
            
            <div className="mt-5 space-y-4">
              <div className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-4 font-mono text-sm text-center text-amber-400 break-all select-all">
                {oneTimeSecret}
              </div>
              
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-400 leading-relaxed space-y-1">
                <p className="font-bold">⚠️ CRITICAL SECURITY WARNING:</p>
                <p>This secret is cryptographically salted and hashed. It is never stored in plain text and **cannot be retrieved or viewed again**.</p>
                <p className="mt-1">Copy it now for hardware provisioning. If lost, a new secret rotation will be required.</p>
              </div>
              
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(oneTimeSecret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 2000);
                  }}
                  className="flex w-full h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all hover:brightness-110 shadow-lg shadow-amber-500/10"
                  style={{ backgroundColor: '#f59e0b', color: '#09090b' }}
                >
                  {copiedSecret ? (
                    <>
                      <Check size={16} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy to Clipboard
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOneTimeSecret(null);
                    setOneTimeSecretDeviceUid(null);
                  }}
                  className="w-full h-12 rounded-xl border border-line bg-white/5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10"
                >
                  I have saved this secret
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Device Modal */}
      {assignDeviceId && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setAssignDeviceId(null); setAssignFleetId(null); }} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-line bg-[#09090b] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setAssignDeviceId(null); setAssignFleetId(null); }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-white">Assign Device to Bike</h2>
            <p className="mt-1 text-sm text-zinc-400">Select a bike from the same fleet to link this device.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Select Bike</label>
                <select
                  value={assignBikeId}
                  onChange={(e) => setAssignBikeId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white outline-none transition focus:border-accent cursor-pointer"
                >
                  <option value="">— Select a bike —</option>
                  {(fleetDetail?.bikes ?? []).map((bike) => (
                    <option key={bike.id} value={bike.id}>
                      {bike.label}{bike.plate ? ` (${bike.plate})` : ''} — {bike.status}
                    </option>
                  ))}
                </select>
              </div>
              {assignError && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{assignError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setAssignDeviceId(null); setAssignFleetId(null); }}
                  className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (assignDeviceId && assignBikeId) {
                      assignMutation.mutate({ deviceId: assignDeviceId, bikeId: assignBikeId });
                    }
                  }}
                  disabled={assignMutation.isPending || !assignBikeId}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {assignMutation.isPending ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
