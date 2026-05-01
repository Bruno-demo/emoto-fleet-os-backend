'use client';

import { useParams, useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Settings, Zap, Globe, Lock, Key, Webhook } from 'lucide-react';
import Link from 'next/link';

export default function PartnerSettingsPage() {
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Integration Settings</h1>
          <p className="mt-1 text-zinc-400">Configure API credentials and webhook destinations for your partner.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-[#121214] py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
            <Key size={32} />
          </div>
          <h3 className="mt-6 font-bold text-white">Credential Manager</h3>
          <p className="mt-2 text-xs text-zinc-500 px-8">Rotate API keys and manage access scopes for partner integration.</p>
          <div className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-[10px] font-mono text-zinc-500">
            Feature Provisioning...
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-[#121214] py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
            <Webhook size={32} />
          </div>
          <h3 className="mt-6 font-bold text-white">Webhook Controller</h3>
          <p className="mt-2 text-xs text-zinc-500 px-8">Define endpoint URLs and subscription events for real-time data sync.</p>
          <div className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-[10px] font-mono text-zinc-500">
            Feature Provisioning...
          </div>
        </div>
      </div>
      
      <div className="flex justify-center">
        <Link 
          href="/hq/partners"
          className="text-sm font-medium text-zinc-500 hover:text-white transition-colors"
        >
          Return to Partner Registry
        </Link>
      </div>
    </div>
  );
}
