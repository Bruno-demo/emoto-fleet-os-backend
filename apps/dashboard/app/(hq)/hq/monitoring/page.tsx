'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Server, Database, Zap, ArrowLeft, BarChart3, Clock, ShieldCheck, HardDrive, Cpu, Users, Bike } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';

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

function formatUptime(secs: number) {
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function HqMonitoringPage() {
  const router = useRouter();

  const { data: monitoring, isLoading: monitoringLoading } = useQuery({
    queryKey: ['hq', 'monitoring', 'live'],
    queryFn: () => apiFetch('/hq/monitoring/live', {}, { schema: monitoringSchema }),
    refetchInterval: 15_000, // Refresh every 15 seconds
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['hq', 'health'],
    queryFn: () => apiFetch('/hq/health', {}, { schema: healthSchema }),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">System Monitoring</h1>
          <p className="mt-1 text-zinc-400">Real-time infrastructure health and telemetry statistics.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-[#18181b] px-4 py-1.5 text-xs font-medium text-zinc-400 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          Live – 15s refresh
        </div>
      </div>

      {/* Real-Time Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile
          icon={<Database size={20} />}
          title="Database Size"
          value={monitoringLoading ? '…' : monitoring?.databaseSize ?? 'N/A'}
          color="text-sky-400"
          bg="bg-sky-400/10"
        />
        <MetricTile
          icon={<BarChart3 size={20} />}
          title="Telemetry Points"
          value={monitoringLoading ? '…' : formatNumber(monitoring?.totalTelemetryPoints ?? 0)}
          color="text-accent"
          bg="bg-accent/10"
        />
        <MetricTile
          icon={<Zap size={20} />}
          title="Total Events"
          value={monitoringLoading ? '…' : formatNumber(monitoring?.totalEvents ?? 0)}
          color="text-amber-400"
          bg="bg-amber-400/10"
        />
        <MetricTile
          icon={<Activity size={20} />}
          title="Total Trips"
          value={monitoringLoading ? '…' : formatNumber(monitoring?.totalTrips ?? 0)}
          color="text-violet-400"
          bg="bg-violet-400/10"
        />
        <MetricTile
          icon={<Cpu size={20} />}
          title="Active Devices"
          value={monitoringLoading ? '…' : String(monitoring?.activeDevices ?? 0)}
          color="text-cyan-400"
          bg="bg-cyan-400/10"
        />
        <MetricTile
          icon={<Users size={20} />}
          title="Active Users"
          value={monitoringLoading ? '…' : String(monitoring?.activeUsers ?? 0)}
          color="text-emerald-400"
          bg="bg-emerald-400/10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Infrastructure Health */}
        <div className="flex flex-col rounded-3xl border border-white/5 bg-[#121214] p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Server size={16} className="text-zinc-400" />
              Infrastructure Health
            </h2>
          </div>
          <div className="mt-6 space-y-4">
            {healthLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1,2,3,4].map(i => <div key={i} className="h-12 w-full rounded-2xl bg-white/5" />)}
              </div>
            ) : (
              health?.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-white/[0.03] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
                      <ShieldCheck size={14} />
                    </div>
                    <span className="text-sm font-medium text-zinc-300">{item.label}</span>
                  </div>
                  <span className={`text-xs font-bold ${item.color}`}>{item.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Uptime & Process Info */}
        <div className="lg:col-span-2 flex flex-col rounded-3xl border border-white/5 bg-[#121214] p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Clock size={16} className="text-zinc-400" />
              System Information
            </h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoRow label="API Uptime" value={monitoringLoading ? '…' : formatUptime(monitoring?.uptimeSeconds ?? 0)} />
            <InfoRow label="Database" value="TimescaleDB (PostgreSQL 16)" />
            <InfoRow label="Message Broker" value="EMQX 5.8 Cluster" />
            <InfoRow label="Object Storage" value="MinIO S3-compatible" />
            <InfoRow label="Cache Layer" value="Redis 7.4 Alpine" />
            <InfoRow label="Gateway" value="NestJS + Fastify" />
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className="rounded-[32px] bg-accent p-8 text-black">
        <ShieldCheck size={32} strokeWidth={2.5} />
        <h3 className="mt-6 text-xl font-black leading-tight uppercase tracking-tight italic">All Systems Operational</h3>
        <p className="mt-2 text-xs font-bold opacity-70">Infrastructure is scaling as expected. Database size: {monitoring?.databaseSize ?? '…'}</p>
      </div>
    </div>
  );
}

function MetricTile({ icon, title, value, color, bg }: { icon: React.ReactNode; title: string; value: string; color: string; bg: string }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#121214] p-6 transition-all hover:translate-y-[-1px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">{title}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.03] bg-white/[0.02] px-4 py-3">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-xs font-bold text-zinc-300">{value}</span>
    </div>
  );
}
