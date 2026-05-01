'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useParams, useRouter } from 'next/navigation';
import { Building2, ArrowLeft, Bike, User, Shield, Zap, Calendar, MapPin, Activity } from 'lucide-react';
import Link from 'next/link';

export default function FleetDetailPage() {
  const { id } = useParams();
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Fleet Management</h1>
          <p className="mt-1 text-zinc-400">Deep dive into organization metrics and node configurations.</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-[#121214] py-32 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-zinc-500">
          <Activity size={40} />
        </div>
        <h2 className="mt-8 text-xl font-bold text-white">Management View Coming Soon</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
          We are currently provisioning the detailed analytics and configuration tools for fleet <span className="font-mono text-accent">#{id}</span>.
        </p>
        <Link 
          href="/hq/fleets"
          className="mt-8 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:scale-105"
        >
          Back to Registry
        </Link>
      </div>
    </div>
  );
}
