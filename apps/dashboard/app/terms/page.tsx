'use client';

import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  Scale,
  Gavel,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';
import { useTranslation } from '@/components/i18n/LanguageProvider';

export default function TermsPage() {
  const { t } = useTranslation();

  const provisions = [
    {
      icon: <DollarSign size={16} className="text-accent" />,
      title: t('info_terms_sec1_title', '1. Permitted Platform Use'),
      content: t('info_terms_sec1_desc', 'E-Moto Fleet OS is licensed exclusively for electric motorcycle fleet operations, telemetry analysis, rider safety tracking, and partner insurance management. Reverse engineering or tampering with hardware is strictly prohibited.'),
    },
    {
      icon: <ShieldAlert size={16} className="text-rose-400" />,
      title: t('info_terms_sec2_title', '2. Subscription & Billing Rules'),
      content: t('info_terms_sec2_desc', 'Subscriptions operate on a Pay-As-You-Go basis at 350 RWF / day per active bike. Daily active bike usage fees are automatically calculated and debited via registered Mobile Money accounts.'),
    },
    {
      icon: <Gavel size={16} className="text-purple-400" />,
      title: t('info_terms_sec3_title', '3. System Uptime & SLA'),
      content: t('info_terms_sec3_desc', 'We maintain target system uptime SLA guarantees for live map telemetry, emergency dispatch alerts, and MQTT telemetry pipelines.'),
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-accent/[0.04] blur-[100px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Gavel size={12} className="text-accent" />
          {t('info_terms_badge', 'Legal Agreement')}
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mt-4">
          {t('info_terms_title', 'Terms of Service & Operational Mandates')}
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base text-zinc-400">
          {t('info_terms_subtitle', 'Read our operational terms, subscription governance, system availability guarantees, and permitted use rules for Kigali fleet operators and riders.')}
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
