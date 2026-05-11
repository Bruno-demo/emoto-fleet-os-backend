'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Plug } from 'lucide-react';

export default function OnboardPartnerPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Partners
        </button>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Onboard New Partner</h1>
        <p className="mt-1 text-zinc-400">Set up a new strategic integration and provision API credentials.</p>
      </div>

      <div className="rounded-[32px] border border-white/5 bg-[#121214] p-12 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 text-zinc-500 mb-6">
          <Plug size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Partner Provisioning is Coming Soon</h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
          The partner self-service provisioning workflow is currently under development. 
          Soon you'll be able to automatically generate scoped API credentials and webhook endpoints for external fleets directly from this dashboard.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-6 text-sm font-bold text-white transition-all hover:bg-white/20 active:scale-95"
        >
          Return to directory
        </button>
      </div>
    </div>
  );
}
