import type { Metadata } from 'next';
import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  Scale,
  Gavel,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | Subscription Conditions',
  description: 'Review active subscriptions, device setup fees (35,000 RWF), operator over-the-air locking liabilities, and strict anti-tampering rules for SinoTrack trackers.',
  keywords: [
    'e-moto terms of service',
    'Safety Core subscription fees',
    'remote lock liability',
    'SinoTrack anti-tamper policy',
    'Kigali fleet operator terms',
  ],
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const provisions = [
    {
      icon: <DollarSign size={16} className="text-accent" />,
      title: '1. Subscription Commitments & Fees',
      content: 'E-Moto offers subscription tiers for fleet operators: Safety Core at 5,000 RWF per bike/month, and Operations Plus at 10,000 RWF per bike/month. Each deployed hardware device requires a one-time device setup & installation fee of 35,000 RWF. Subscriptions are billed monthly and subject to hardware validation limits.',
    },
    {
      icon: <ShieldAlert size={16} className="text-rose-400" />,
      title: '2. Remote Over-The-Air (OTA) Commands',
      content: 'The dashboard equips fleet operators with remote lock, unlock, and security arm commands. Operators assume full liability for sending OTA lock commands, ensuring the vehicle is verified stationary on telemetry feeds beforehand. E-Moto is not liable for unauthorized operator commands.',
    },
    {
      icon: <Gavel size={16} className="text-purple-400" />,
      title: '3. Hardware Modification &amp; Tampering',
      content: 'Operators agree to maintain standard SinoTrack ST-901 or approved IoT boards without bypassing, physical disabling, or swapping SIM cards. Tampering with telemetry feeds triggers immediate system isolation and suspends active insurance scores.',
    },
    {
      icon: <Scale size={16} className="text-emerald-400" />,
      title: '4. Limitation of Liability',
      content: 'E-Moto operates as a real-time safety metrics and dispatch coordination hub. We do not assume liability for driver conduct, battery depletion damage, accidents, or force majeure events within Kigali municipality zones.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-accent/[0.04] blur-[100px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Gavel size={12} className="text-accent" />
          Service Conditions
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mt-4">
          Terms of Service
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base text-zinc-400">
          Last updated: May 26, 2026. Please read these terms carefully before deploying SinoTrack hardware modules or initiating active fleet tracking subscriptions.
        </p>
      </section>

      {/* Core Terms Content */}
      <section className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="space-y-10 text-left">
          {provisions.map((p, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                {p.icon}
                <h2 className="text-base md:text-lg font-bold text-white">{p.title}</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400" dangerouslySetInnerHTML={{ __html: p.content }} />
            </div>
          ))}

          {/* Legal contact */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 mt-10">
            <h3 className="text-xs font-bold text-white">Contact Billing & Operations</h3>
            <p className="text-[11px] leading-relaxed text-zinc-500 mt-2">
              For any questions regarding billing disputes, remote lock audits, or custom enterprise SLAs, please contact our contracts desk at{' '}
              <a href="mailto:billing@emotofleet.com" className="text-accent hover:underline">
                billing@emotofleet.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
