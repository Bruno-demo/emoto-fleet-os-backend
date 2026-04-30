'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Bike, UserPlus, Globe } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';

const statsSchema = z.object({
  totalFleets: z.number(),
  totalBikes: z.number(),
  totalPendingSetups: z.number(),
  totalPartners: z.number(),
});

export default function HqOverviewPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hq', 'stats'],
    queryFn: () => apiFetch('/hq/stats', {}, { schema: statsSchema }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="mt-1 text-sm text-zinc-400">Global overview of the E-Moto Fleet OS platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Fleets"
          value={isLoading ? '-' : data?.totalFleets.toLocaleString()}
          icon={<Building2 size={18} />}
        />
        <MetricCard
          title="Total Bikes"
          value={isLoading ? '-' : data?.totalBikes.toLocaleString()}
          icon={<Bike size={18} />}
        />
        <MetricCard
          title="Pending Setups"
          value={isLoading ? '-' : data?.totalPendingSetups.toLocaleString()}
          icon={<UserPlus size={18} />}
          alert={data && data.totalPendingSetups > 0}
        />
        <MetricCard
          title="Active Partners"
          value={isLoading ? '-' : data?.totalPartners.toLocaleString()}
          icon={<Globe size={18} />}
        />
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon,
  alert
}: { 
  title: string; 
  value: string | undefined; 
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-[#18181b] p-6 transition-all hover:bg-[#27272a] ${alert ? 'border-warning-ink shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-white/10'}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${alert ? 'bg-warning-soft text-warning-ink' : 'bg-white/5 text-zinc-300'}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <h3 className={`text-3xl font-bold tracking-tight ${alert ? 'text-warning-ink' : 'text-white'}`}>{value}</h3>
      </div>
    </div>
  );
}
