'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  Building2, 
  Bike, 
  Cpu,
  UserPlus, 
  Globe, 
  TrendingUp, 
  Activity, 
  Zap, 
  CheckCircle2, 
  Server,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Search,
  X,
  Loader2
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

const statsSchema = z.object({
  totalFleets: z.number(),
  totalBikes: z.number(),
  totalPendingSetups: z.number(),
  totalPartners: z.number(),
  totalInsurers: z.number().optional(),
  unassignedDevices: z.number().optional(),
  dailyTripTrend: z.array(z.object({
    date: z.string(),
    count: z.number()
  })).optional(),
});

const pendingCountSchema = z.object({
  pendingUsers: z.number(),
  pendingBikes: z.number(),
});

const healthSchema = z.array(z.object({
  label: z.string(),
  status: z.string(),
  color: z.string(),
}));

const eventSchema = z.array(z.object({
  fleet: z.string(),
  event: z.string(),
  time: z.string(),
  type: z.enum(['success', 'info', 'warning']),
}));

const globalSearchResponseSchema = z.object({
  fleets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    plan: z.string(),
    subscriptionStatus: z.string(),
  })),
  users: z.array(z.object({
    id: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    role: z.string(),
    status: z.string(),
    fleetName: z.string(),
    fullName: z.string(),
  })),
  bikes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    plate: z.string().nullable(),
    serial: z.string().nullable(),
    model: z.string().nullable(),
    status: z.string(),
    fleetId: z.string(),
    fleetName: z.string(),
  })),
  devices: z.array(z.object({
    id: z.string(),
    deviceUid: z.string(),
    imei: z.string().nullable(),
    status: z.string(),
    fleetName: z.string(),
    bikeLabel: z.string().nullable(),
  })),
  logs: z.array(z.object({
    id: z.string(),
    actionType: z.string(),
    targetType: z.string(),
    targetId: z.string().nullable(),
    createdAt: z.string(),
    fleetName: z.string(),
    actorEmail: z.string().nullable(),
  })),
});

export default function HqOverviewPage() {
  const router = useRouter();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['hq', 'stats'],
    queryFn: () => apiFetch('/hq/stats', {}, { schema: statsSchema }),
  });

  const { data: pendingCount } = useQuery({
    queryKey: ['hq', 'pending-count'],
    queryFn: () => apiFetch('/hq/pending-setups/count', {}, { schema: pendingCountSchema }),
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['hq', 'health'],
    queryFn: () => apiFetch('/hq/health', {}, { schema: healthSchema }),
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['hq', 'events'],
    queryFn: () => apiFetch('/hq/events', {}, { schema: eventSchema }),
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ['hq', 'global-search', debouncedQuery],
    queryFn: () => {
      if (!debouncedQuery.trim()) return null;
      return apiFetch(`/hq/search?q=${encodeURIComponent(debouncedQuery)}`, {}, { schema: globalSearchResponseSchema });
    },
    enabled: debouncedQuery.trim().length >= 2,
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Command Center</h1>
          <p className="mt-1 text-zinc-400">Strategic oversight of the E-Moto Fleet OS global network.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-[#18181b] px-4 py-1.5 text-xs font-medium text-zinc-400 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Live Telemetry Active
          </div>
        </div>
      </div>

      {/* Global Unified Search */}
      <div ref={searchRef} className="relative z-50 max-w-xl">
        <div className="relative group flex items-center">
          <Search className="absolute left-4 text-zinc-500 group-focus-within:text-accent transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search fleets, users, bikes, devices, logs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="h-12 w-full rounded-2xl border border-line bg-[#18181b]/80 backdrop-blur-md pl-12 pr-10 text-xs text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
          />
          {searchLoading && (
            <Loader2 className="absolute right-4 text-zinc-500 animate-spin" size={18} />
          )}
          {!searchLoading && searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsOpen(false);
              }}
              className="absolute right-4 text-zinc-500 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {isOpen && debouncedQuery.trim().length >= 2 && (
          <div className="absolute left-0 mt-2 w-full max-h-[480px] overflow-y-auto rounded-2xl border border-line bg-[#161618]/95 backdrop-blur-xl p-4 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {searchLoading && !searchResults && (
              <div className="py-8 text-center text-zinc-500 text-xs">Searching global database...</div>
            )}
            
            {!searchLoading && searchResults && 
              Object.values(searchResults).every(arr => arr.length === 0) && (
              <div className="py-8 text-center text-zinc-500 text-xs">No matches found for &quot;{debouncedQuery}&quot;</div>
            )}

            {searchResults && (
              <>
                {/* Fleets */}
                {searchResults.fleets.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-2">Fleets</div>
                    <div className="space-y-1">
                      {searchResults.fleets.map(f => (
                        <Link
                          key={f.id}
                          href={`/hq/fleets/${f.id}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{f.name}</span>
                            <span className="text-[10px] text-zinc-400 capitalize">{f.type.toLowerCase()} · Plan: {f.plan}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            f.subscriptionStatus === 'ACTIVE' 
                              ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                              : 'bg-rose-400/10 text-rose-400 border-rose-400/20'
                          }`}>
                            {f.subscriptionStatus}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users */}
                {searchResults.users.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-2">Users</div>
                    <div className="space-y-1">
                      {searchResults.users.map(u => (
                        <Link
                          key={u.id}
                          href={`/hq/users?search=${encodeURIComponent(u.email || u.phone || '')}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{u.fullName}</span>
                            <span className="text-[10px] text-zinc-400">{u.email || u.phone} · {u.fleetName}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium px-2 py-0.5 rounded bg-white/5 border border-white/10 uppercase">
                            {u.role}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bikes */}
                {searchResults.bikes.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-2">Bikes</div>
                    <div className="space-y-1">
                      {searchResults.bikes.map(b => (
                        <Link
                          key={b.id}
                          href={`/hq/fleets/${b.fleetId}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{b.label}</span>
                            <span className="text-[10px] text-zinc-400">
                              Plate: {b.plate || 'N/A'} · Model: {b.model || 'N/A'} · {b.fleetName}
                            </span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            b.status === 'ACTIVE' 
                              ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                              : b.status === 'MAINTENANCE'
                              ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                              : 'bg-rose-400/10 text-rose-400 border-rose-400/20'
                          }`}>
                            {b.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Devices */}
                {searchResults.devices.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-2">Devices</div>
                    <div className="space-y-1">
                      {searchResults.devices.map(d => (
                        <Link
                          key={d.id}
                          href={`/hq/devices?search=${encodeURIComponent(d.deviceUid)}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{d.deviceUid}</span>
                            <span className="text-[10px] text-zinc-400">
                              IMEI: {d.imei || 'N/A'} · Bike: {d.bikeLabel || 'None'} · {d.fleetName}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium px-2 py-0.5 rounded bg-white/5 border border-white/10 uppercase">
                            {d.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Logs */}
                {searchResults.logs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-2">Audit Logs</div>
                    <div className="space-y-1">
                      {searchResults.logs.map(l => (
                        <Link
                          key={l.id}
                          href="/hq/audit"
                          className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{l.actionType.replaceAll('_', ' ')}</span>
                            <span className="text-[10px] text-zinc-400">
                              Target: {l.targetType} ({l.targetId || 'N/A'}) · Actor: {l.actorEmail}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium font-mono">
                            {new Date(l.createdAt).toLocaleDateString()}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Fleets"
          value={statsLoading ? '-' : stats?.totalFleets.toLocaleString()}
          icon={<Building2 size={20} />}
          trend="+12% this month"
          trendUp={true}
          onClick={() => router.push('/hq/fleets')}
        />
        <MetricCard
          title="Global Nodes (Bikes)"
          value={statsLoading ? '-' : stats?.totalBikes.toLocaleString()}
          icon={<Bike size={20} />}
          trend="+8.2% scaling"
          trendUp={true}
        />
        <MetricCard
          title="Pending Provisioning"
          value={statsLoading ? '-' : ((pendingCount?.pendingUsers ?? 0) + (pendingCount?.pendingBikes ?? 0)).toLocaleString()}
          icon={<UserPlus size={20} />}
          trend={pendingCount ? `${pendingCount.pendingUsers} users · ${pendingCount.pendingBikes} bikes` : 'Action required'}
          alert={!!pendingCount && (pendingCount.pendingUsers + pendingCount.pendingBikes) > 0}
          onClick={() => router.push('/hq/pending-setups')}
        />
        <MetricCard
          title="Partners & Insurers"
          value={statsLoading ? '-' : ((stats?.totalPartners ?? 0) + (stats?.totalInsurers ?? 0)).toLocaleString()}
          icon={<Globe size={20} />}
          trend={`${stats?.totalPartners ?? 0} API · ${stats?.totalInsurers ?? 0} Insurers`}
          trendUp={true}
          onClick={() => router.push('/hq/insurers')}
        />
      </div>

      {stats?.dailyTripTrend && (
        <GlobalActivityChart dailyTripTrend={stats.dailyTripTrend} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Platform Health */}
        <div className="flex flex-col rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Server size={16} className="text-zinc-400" />
              Platform Health
            </h2>
            <Link href="/hq/monitoring" className="text-xs font-medium text-zinc-500 hover:text-white transition-colors">
              Full Status
            </Link>
          </div>
          <div className="mt-6 space-y-6">
            {healthLoading ? (
               <div className="space-y-4 animate-pulse">
                 {[1,2,3,4].map(i => <div key={i} className="h-12 w-full rounded-2xl bg-white/5" />)}
               </div>
            ) : (
              health?.map((item, i) => (
                <HealthItem key={i} label={item.label} status={item.status} icon={<ShieldCheck size={14} />} color={item.color} />
              ))
            )}
          </div>
        </div>

        {/* Global Activity Timeline */}
        <div className="lg:col-span-2 flex flex-col rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Activity size={16} className="text-zinc-400" />
              Real-time Event Stream
            </h2>
          </div>
          <div className="mt-6 space-y-5">
            {eventsLoading ? (
               <div className="space-y-4 animate-pulse">
                 {[1,2,3].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-white/5" />)}
               </div>
            ) : events?.length === 0 ? (
               <div className="py-12 text-center text-zinc-500">No recent events logged.</div>
            ) : (
              events?.map((event, i) => (
                <ActivityItem 
                  key={i}
                  fleet={event.fleet} 
                  event={event.event} 
                  time={event.time} 
                  type={event.type}
                  icon={event.type === 'success' ? <CheckCircle2 size={12} /> : <Zap size={12} />}
                />
              ))
            )}
          </div>
          <button 
            onClick={() => router.push('/hq/monitoring')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white/5 py-2.5 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            View All Platform Logs
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon,
  trend,
  trendUp,
  alert,
  onClick
}: { 
  title: string; 
  value: string | undefined; 
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl border p-6 transition-all hover:translate-y-[-2px] ${onClick ? 'cursor-pointer' : ''} ${alert ? 'border-warning-ink/30 bg-warning-soft shadow-[0_0_20px_rgba(245,158,11,0.05)]' : 'border-line bg-surface-strong'}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">{title}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${alert ? 'bg-warning/20 text-warning' : 'bg-white/5 text-zinc-400 group-hover:bg-white/10 group-hover:text-white'}`}>
          {icon}
        </div>
      </div>
      <div className="mt-6 flex items-baseline gap-2">
        <h3 className={`text-4xl font-extrabold tracking-tight ${alert ? 'text-warning' : 'text-white'}`}>{value}</h3>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5">
          {trendUp && <ArrowUpRight size={14} className="text-emerald-400" />}
          <span className={`text-xs font-medium ${trendUp ? 'text-emerald-400' : 'text-zinc-500'}`}>{trend}</span>
        </div>
      )}
    </div>
  );
}

function HealthItem({ label, status, icon, color }: { label: string; status: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.03] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
          {icon}
        </div>
        <span className="text-sm font-medium text-ink-soft">{label}</span>
      </div>
      <span className={`text-xs font-bold ${color}`}>{status}</span>
    </div>
  );
}

function ActivityItem({ fleet, event, time, type, icon }: { fleet: string; event: string; time: string; type: 'success' | 'info' | 'warning'; icon: React.ReactNode }) {
  const colors = {
    success: 'bg-emerald-400',
    info: 'bg-sky-400',
    warning: 'bg-amber-400'
  };

  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400">
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-200">{fleet}</p>
          <span className="text-[10px] text-zinc-500">{time}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-1 w-1 rounded-full ${colors[type]}`}></div>
          <p className="text-xs text-zinc-400">{event}</p>
        </div>
      </div>
    </div>
  );
}

function GlobalActivityChart({
  dailyTripTrend,
}: {
  dailyTripTrend: Array<{ date: string; count: number }>;
}) {
  const width = 600;
  const height = 180;
  const paddingLeft = 30;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxCount = Math.max(...dailyTripTrend.map((t) => t.count), 10);

  const svgPoints = dailyTripTrend
    .map((p, index) => {
      const x = paddingLeft + (index / Math.max(1, dailyTripTrend.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (p.count / maxCount) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const startX = paddingLeft;
  const endX = paddingLeft + chartWidth;
  const bottomY = paddingTop + chartHeight;
  const areaPath = dailyTripTrend.length > 1 ? `M ${startX} ${bottomY} L ${svgPoints} L ${endX} ${bottomY} Z` : '';

  return (
    <div className="flex flex-col rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <TrendingUp size={16} className="text-emerald-400" />
            Global Activity Trend
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Processed daily trip volumes over the last 7 days.</p>
        </div>
      </div>
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="hqAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[1, 0.75, 0.5, 0.25].map((factor) => {
            const val = Math.round(maxCount * factor);
            const y = paddingTop + chartHeight - (val / maxCount) * chartHeight;
            return (
              <g key={factor} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 font-mono text-[8px]"
                >
                  {val}
                </text>
              </g>
            );
          })}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.1)"
          />

          {/* X Axis Labels */}
          {dailyTripTrend.map((p, index) => {
            const x = paddingLeft + (index / Math.max(1, dailyTripTrend.length - 1)) * chartWidth;
            return (
              <text
                key={index}
                x={x}
                y={height - paddingBottom + 15}
                textAnchor="middle"
                className="fill-zinc-500 font-mono text-[7px]"
              >
                {p.date}
              </text>
            );
          })}

          {/* Area fill */}
          {dailyTripTrend.length > 1 && (
            <path d={areaPath} fill="url(#hqAreaGradient)" />
          )}

          {/* Line */}
          {dailyTripTrend.length > 1 && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
            />
          )}

          {/* Data points */}
          {dailyTripTrend.map((p, i) => {
            const x = paddingLeft + (i / Math.max(1, dailyTripTrend.length - 1)) * chartWidth;
            const y = paddingTop + chartHeight - (p.count / maxCount) * chartHeight;
            return (
              <g key={i} className="group cursor-pointer">
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-[#10b981] stroke-[#161618] stroke-[1.5] opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <title>{`${p.date}: ${p.count} trips`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

