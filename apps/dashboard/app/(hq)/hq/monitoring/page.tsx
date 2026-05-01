'use client';

import { Activity, Server, Database, Zap, ArrowLeft, BarChart3, Clock, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HqMonitoringPage() {
  const router = useRouter();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">System Monitoring</h1>
          <p className="mt-1 text-zinc-400">Real-time infrastructure health and telemetry ingestion logs.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[32px] border border-white/5 bg-[#121214] p-8">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-accent" />
                Ingestion Throughput
              </h3>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Live Stream</span>
            </div>
            <div className="mt-12 flex h-48 items-end gap-2 px-4">
              {Array.from({ length: 40 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-full bg-accent/20 rounded-t-sm hover:bg-accent transition-all cursor-crosshair"
                  style={{ height: `${Math.random() * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-8 grid grid-cols-3 border-t border-white/5 pt-8">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Peak Rate</p>
                <p className="mt-1 text-lg font-bold text-white">12.4k req/s</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Avg Latency</p>
                <p className="mt-1 text-lg font-bold text-white">42ms</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Error Rate</p>
                <p className="mt-1 text-lg font-bold text-emerald-400">0.002%</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/5 bg-[#121214] p-8">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-zinc-400" />
              Recent System Logs
            </h3>
            <div className="mt-6 space-y-3 font-mono text-[10px]">
              <div className="flex gap-4 text-zinc-500 py-2 border-b border-white/[0.02]">
                <span className="text-emerald-500">[INFO]</span>
                <span>2026-05-01 21:45:02</span>
                <span className="text-zinc-300">Auth Service: Session validated for user #HQ_ADMIN_01</span>
              </div>
              <div className="flex gap-4 text-zinc-500 py-2 border-b border-white/[0.02]">
                <span className="text-emerald-500">[INFO]</span>
                <span>2026-05-01 21:44:55</span>
                <span className="text-zinc-300">EMQX: Client disconnected (Kigali_Node_24)</span>
              </div>
              <div className="flex gap-4 text-zinc-500 py-2 border-b border-white/[0.02]">
                <span className="text-sky-500">[DEBUG]</span>
                <span>2026-05-01 21:44:30</span>
                <span className="text-zinc-400">Prisma: Query executed (SELECT * FROM "Fleet"...)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-white/5 bg-[#121214] p-6">
            <h3 className="text-sm font-bold text-white">Infrastructure</h3>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <Server size={14} className="text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-300">Cluster 01</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <Database size={14} className="text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-300">PostgreSQL</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
          
          <div className="rounded-[32px] bg-accent p-8 text-black">
            <ShieldCheck size={32} strokeWidth={2.5} />
            <h3 className="mt-6 text-xl font-black leading-tight uppercase tracking-tight italic">All Systems Operational</h3>
            <p className="mt-2 text-xs font-bold opacity-70">Infrastructure is scaling as expected for peak traffic periods.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
