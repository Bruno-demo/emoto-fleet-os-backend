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
  ChevronRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const statsSchema = z.object({
  totalFleets: z.number(),
  totalBikes: z.number(),
  totalPendingSetups: z.number(),
  totalPartners: z.number(),
  totalInsurers: z.number().optional(),
  unassignedDevices: z.number().optional(),
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

export default function HqOverviewPage() {
  const router = useRouter();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['hq', 'stats'],
    queryFn: () => apiFetch('/hq/stats', {}, { schema: statsSchema }),
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['hq', 'health'],
    queryFn: () => apiFetch('/hq/health', {}, { schema: healthSchema }),
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['hq', 'events'],
    queryFn: () => apiFetch('/hq/events', {}, { schema: eventSchema }),
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          value={statsLoading ? '-' : stats?.totalPendingSetups.toLocaleString()}
          icon={<UserPlus size={20} />}
          trend="Action required"
          alert={stats && stats.totalPendingSetups > 0}
          onClick={() => router.push('/hq/pending-setups')}
        />
        <MetricCard
          title="API Partners"
          value={statsLoading ? '-' : stats?.totalPartners.toLocaleString()}
          icon={<Globe size={20} />}
          trend="Healthy integration"
          trendUp={true}
        />
        <MetricCard
          title="Insurers"
          value={statsLoading ? '-' : (stats?.totalInsurers ?? 0).toLocaleString()}
          icon={<ShieldCheck size={20} />}
          trend="Insurance partners"
          trendUp={true}
          onClick={() => router.push('/hq/insurers')}
        />
        <MetricCard
          title="Unassigned Devices"
          value={statsLoading ? '-' : (stats?.unassignedDevices ?? 0).toLocaleString()}
          icon={<Cpu size={20} />}
          trend="Needs assignment"
          alert={!!stats && (stats.unassignedDevices ?? 0) > 0}
          onClick={() => router.push('/hq/devices')}
        />
      </div>

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

