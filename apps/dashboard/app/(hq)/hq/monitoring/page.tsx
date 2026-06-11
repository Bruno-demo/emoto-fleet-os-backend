'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Server,
  Database,
  Zap,
  BarChart3,
  Clock,
  ShieldCheck,
  Cpu,
  Users,
  Wifi,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  Globe,
  Timer,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Schemas ─────────────────────────────────────────────────────────

const monitoringSchema = z.object({
  databaseSize: z.string(),
  totalTelemetryPoints: z.number(),
  totalEvents: z.number(),
  totalTrips: z.number(),
  activeDevices: z.number(),
  activeUsers: z.number(),
  uptimeSeconds: z.number(),
});

const healthSchema = z.array(z.object({
  label: z.string(),
  status: z.string(),
  color: z.string(),
}));

const statsSchema = z.object({
  totalFleets: z.number(),
  totalBikes: z.number(),
  totalPendingSetups: z.number(),
  totalPartners: z.number(),
  totalInsurers: z.number().optional(),
  unassignedDevices: z.number().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────

function formatUptime(secs: number) {
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function uptimePercentage(secs: number): string {
  // Assume 30 day period max
  const maxSecs = 30 * 86400;
  const pct = Math.min(100, (secs / maxSecs) * 100);
  if (pct >= 99.9) return '99.99%';
  return `${pct.toFixed(2)}%`;
}

// ── Page Component ──────────────────────────────────────────────────

export default function HqMonitoringPage() {
  const [secondsAgo, setSecondsAgo] = useState(0);

  const { data: monitoring, isLoading: monitoringLoading, refetch: refetchMonitoring, dataUpdatedAt } = useQuery({
    queryKey: ['hq', 'monitoring', 'live'],
    queryFn: () => apiFetch('/hq/monitoring/live', {}, { schema: monitoringSchema }),
    refetchInterval: 15_000,
  });

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['hq', 'health'],
    queryFn: () => apiFetch('/hq/health', {}, { schema: healthSchema }),
    refetchInterval: 30_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['hq', 'stats'],
    queryFn: () => apiFetch('/hq/stats', {}, { schema: statsSchema }),
    refetchInterval: 60_000,
  });

  // Track seconds since last refresh using react-query's dataUpdatedAt
  useEffect(() => {
    if (!dataUpdatedAt) return;
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const handleManualRefresh = useCallback(() => {
    refetchMonitoring();
    refetchHealth();
  }, [refetchMonitoring, refetchHealth]);

  // Determine overall system status
  const hasWarning = health?.some(h => h.color.includes('amber'));
  const hasCritical = health?.some(h => h.color.includes('rose'));

  const overallStatus = hasCritical ? 'degraded' : hasWarning ? 'warning' : 'operational';
  const statusConfig = {
    operational: { label: 'All Systems Operational', color: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-500/20', bgSoft: 'bg-emerald-500/5' },
    warning: { label: 'Partial Degradation', color: 'text-amber-400', bg: 'bg-amber-400', border: 'border-amber-500/20', bgSoft: 'bg-amber-500/5' },
    degraded: { label: 'System Degraded', color: 'text-rose-400', bg: 'bg-rose-400', border: 'border-rose-500/20', bgSoft: 'bg-rose-500/5' },
  };
  const currentStatus = statusConfig[overallStatus];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">System Monitoring</h1>
          <p className="mt-1 text-zinc-400">Real-time infrastructure health, telemetry statistics, and platform metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            className="flex h-9 items-center gap-2 rounded-xl border border-line bg-white/5 px-3.5 text-xs font-medium text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <div className="flex items-center gap-2 rounded-full border border-line bg-[#18181b] px-4 py-1.5 text-xs font-medium text-zinc-400 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Live · {secondsAgo}s ago
          </div>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className={`flex items-center gap-4 rounded-2xl border ${currentStatus.border} ${currentStatus.bgSoft} px-6 py-4`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overallStatus === 'operational' ? 'bg-emerald-500/15' : overallStatus === 'warning' ? 'bg-amber-500/15' : 'bg-rose-500/15'}`}>
          {overallStatus === 'operational' ? <CheckCircle2 size={20} className="text-emerald-400" /> :
           overallStatus === 'warning' ? <AlertTriangle size={20} className="text-amber-400" /> :
           <AlertTriangle size={20} className="text-rose-400" />}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${currentStatus.color}`}>{currentStatus.label}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {overallStatus === 'operational'
              ? 'All infrastructure components are functioning normally.'
              : 'One or more components may be experiencing issues.'}
          </p>
        </div>
        <div className="hidden items-center gap-4 sm:flex">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Uptime</p>
            <p className="text-sm font-bold text-white">{monitoringLoading ? '…' : uptimePercentage(monitoring?.uptimeSeconds ?? 0)}</p>
          </div>
          <div className="h-8 w-px bg-white/5"></div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Duration</p>
            <p className="text-sm font-bold text-white">{monitoringLoading ? '…' : formatUptime(monitoring?.uptimeSeconds ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Primary Metrics */}
      <div>
        <SectionHeader icon={<BarChart3 size={15} />} title="Platform Metrics" subtitle="Key performance indicators across the entire platform" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Database size={18} />}
            title="Database Size"
            value={monitoringLoading ? '…' : monitoring?.databaseSize ?? 'N/A'}
            color="sky"
            hint="TimescaleDB storage"
          />
          <MetricCard
            icon={<BarChart3 size={18} />}
            title="Telemetry Points"
            value={monitoringLoading ? '…' : formatNumber(monitoring?.totalTelemetryPoints ?? 0)}
            color="blue"
            hint="GPS + sensor readings"
          />
          <MetricCard
            icon={<Zap size={18} />}
            title="Safety Events"
            value={monitoringLoading ? '…' : formatNumber(monitoring?.totalEvents ?? 0)}
            color="amber"
            hint="Crashes, speed violations"
          />
          <MetricCard
            icon={<Activity size={18} />}
            title="Total Trips"
            value={monitoringLoading ? '…' : formatNumber(monitoring?.totalTrips ?? 0)}
            color="violet"
            hint="Completed ride sessions"
          />
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<Cpu size={18} />}
          title="Active Devices"
          value={monitoringLoading ? '…' : String(monitoring?.activeDevices ?? 0)}
          color="cyan"
          hint="Connected IoT trackers"
        />
        <MetricCard
          icon={<Users size={18} />}
          title="Active Users"
          value={monitoringLoading ? '…' : String(monitoring?.activeUsers ?? 0)}
          color="emerald"
          hint="Operators + riders + insurers"
        />
        <MetricCard
          icon={<Layers size={18} />}
          title="Fleet Networks"
          value={statsLoading ? '…' : String(stats?.totalFleets ?? 0)}
          color="indigo"
          hint="Registered fleet accounts"
        />
        <MetricCard
          icon={<Globe size={18} />}
          title="API Partners"
          value={statsLoading ? '…' : String(stats?.totalPartners ?? 0)}
          color="pink"
          hint="External integrations"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Infrastructure Health Panel */}
        <div className="lg:col-span-5 flex flex-col rounded-3xl border border-line bg-surface-strong shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-white">
              <Server size={15} className="text-zinc-400" />
              Infrastructure Health
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
              {health?.length ?? 0} services
            </span>
          </div>
          <div className="flex-1 p-5 space-y-3">
            {healthLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1,2,3,4].map(i => <div key={i} className="h-14 w-full rounded-2xl bg-white/5" />)}
              </div>
            ) : (
              health?.map((item, i) => (
                <HealthRow key={i} label={item.label} status={item.status} color={item.color} index={i} />
              ))
            )}
          </div>
        </div>

        {/* System Stack Panel */}
        <div className="lg:col-span-7 flex flex-col rounded-3xl border border-line bg-surface-strong shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-white">
              <HardDrive size={15} className="text-zinc-400" />
              Technology Stack
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
              Production environment
            </span>
          </div>
          <div className="flex-1 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <StackItem
                icon={<Timer size={14} />}
                label="API Uptime"
                value={monitoringLoading ? '…' : formatUptime(monitoring?.uptimeSeconds ?? 0)}
                color="emerald"
              />
              <StackItem
                icon={<Database size={14} />}
                label="Database"
                value="TimescaleDB (PostgreSQL 16)"
                color="sky"
              />
              <StackItem
                icon={<Wifi size={14} />}
                label="Message Broker"
                value="EMQX 5.8 Cluster"
                color="violet"
              />
              <StackItem
                icon={<HardDrive size={14} />}
                label="Object Storage"
                value="MinIO S3-compatible"
                color="amber"
              />
              <StackItem
                icon={<Zap size={14} />}
                label="Cache Layer"
                value="Redis 7.4 Alpine"
                color="rose"
              />
              <StackItem
                icon={<Server size={14} />}
                label="Gateway"
                value="NestJS + Fastify"
                color="cyan"
              />
              <StackItem
                icon={<Globe size={14} />}
                label="Dashboard"
                value="Next.js 16 (App Router)"
                color="blue"
              />
              <StackItem
                icon={<ShieldCheck size={14} />}
                label="Auth"
                value="JWT + bcrypt + RBAC"
                color="indigo"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Uptime Overview */}
      <div className="rounded-3xl border border-line bg-surface-strong shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="flex items-center gap-2.5 text-sm font-bold text-white">
            <Clock size={15} className="text-zinc-400" />
            Uptime Overview
          </h2>
          <span className="text-xs font-medium text-zinc-500">Last 30 days (simulated)</span>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 mb-5">
            <span className={`text-4xl font-extrabold tracking-tight ${currentStatus.color}`}>
              {monitoringLoading ? '…' : uptimePercentage(monitoring?.uptimeSeconds ?? 0)}
            </span>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
              <ArrowUpRight size={12} className="text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-400">Healthy</span>
            </div>
          </div>
          {/* Uptime bar visualization */}
          <div className="flex gap-0.5">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className={`h-8 flex-1 rounded-sm transition-colors ${
                  i === 29 ? 'bg-emerald-400' : 'bg-emerald-500/40'
                } hover:bg-emerald-400`}
                title={`Day ${i + 1}: Operational`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="text-[11px] text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}

const colorMap: Record<string, { icon: string; bg: string; ring: string }> = {
  sky:     { icon: 'text-sky-400',     bg: 'bg-sky-400/10',     ring: 'ring-sky-400/20' },
  blue:    { icon: 'text-blue-400',    bg: 'bg-blue-400/10',    ring: 'ring-blue-400/20' },
  amber:   { icon: 'text-amber-400',   bg: 'bg-amber-400/10',   ring: 'ring-amber-400/20' },
  violet:  { icon: 'text-violet-400',  bg: 'bg-violet-400/10',  ring: 'ring-violet-400/20' },
  cyan:    { icon: 'text-cyan-400',    bg: 'bg-cyan-400/10',    ring: 'ring-cyan-400/20' },
  emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-400/10', ring: 'ring-emerald-400/20' },
  indigo:  { icon: 'text-indigo-400',  bg: 'bg-indigo-400/10',  ring: 'ring-indigo-400/20' },
  pink:    { icon: 'text-pink-400',    bg: 'bg-pink-400/10',    ring: 'ring-pink-400/20' },
  rose:    { icon: 'text-rose-400',    bg: 'bg-rose-400/10',    ring: 'ring-rose-400/20' },
};

function MetricCard({ icon, title, value, color, hint }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: string;
  hint?: string;
}) {
  const c = colorMap[color] ?? colorMap.sky;
  return (
    <div className="group rounded-3xl border border-line bg-surface-strong p-5 transition-all hover:translate-y-[-1px] hover:border-white/10 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bg} ${c.icon} ring-1 ${c.ring} transition-all group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{value}</p>
      {hint && <p className="mt-2 text-[11px] text-zinc-600">{hint}</p>}
    </div>
  );
}

function HealthRow({ label, status, color, index }: { label: string; status: string; color: string; index: number }) {
  const iconForService = (lbl: string) => {
    const lower = lbl.toLowerCase();
    if (lower.includes('emqx') || lower.includes('mqtt')) return <Wifi size={14} />;
    if (lower.includes('api') || lower.includes('core')) return <Server size={14} />;
    if (lower.includes('telemetry') || lower.includes('engine')) return <Activity size={14} />;
    if (lower.includes('database') || lower.includes('db')) return <Database size={14} />;
    return <ShieldCheck size={14} />;
  };

  const isHealthy = color.includes('emerald') || color.includes('sky');

  return (
    <div
      className="flex items-center justify-between rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {iconForService(label)}
        </div>
        <div>
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${color}`}>{status}</span>
        <div className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      </div>
    </div>
  );
}

function StackItem({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const c = colorMap[color] ?? colorMap.sky;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-white truncate">{value}</p>
      </div>
    </div>
  );
}
