import type { Metadata } from 'next';
import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  ShieldCheck,
  Scale,
  MapPin,
  Activity,
  HeartHandshake,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Regulatory Compliance & Legal Standards | eMoto Fleet OS',
  description: 'Review our municipal safety bounds, hospital zone speed limits, insurer-scoped telemetry audits, and GDPR-aligned data protection frameworks in Kigali, Rwanda.',
  keywords: [
    'e-moto compliance',
    'Kigali geofence speed limits',
    'GDPR telemetry data protection',
    'insurance audits motorcycle',
    'municipal mobility policy',
  ],
  alternates: {
    canonical: '/compliance',
  },
};

export default function CompliancePage() {
  const sections = [
    {
      icon: <MapPin size={20} className="text-accent" />,
      title: 'Geofenced Safety Bounds',
      desc: 'Automatic alert escalation rules within Kigali municipality boundaries. Telemetry streams instantly verify if bikes enter restricted environmental zones or commercial routes.',
    },
    {
      icon: <Activity size={20} className="text-rose-400" />,
      title: 'Hospital Zone Speed Limits',
      desc: 'Enforcing localized speed limitations (max 30 km/h) across critical hospital sectors, schools, and pedestrian zones to ensure community safety.',
    },
    {
      icon: <HeartHandshake size={20} className="text-emerald-400" />,
      title: 'Insurer-Scoped Telemetry Audits',
      desc: 'Granular data filtering algorithms ensure that insurer nodes only read necessary trip-safety scores, protecting rider identities and keeping records isolated.',
    },
    {
      icon: <Scale size={20} className="text-purple-400" />,
      title: 'E-Mobility Carbon Certifications',
      desc: 'Accurately convert your zero-emission electric miles into audit-ready Carbon Credit claims verified by local environment regulations.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-accent/[0.04] blur-[120px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Scale size={12} className="text-accent" />
          Regulatory Compliance Standards
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight mt-4">
          Municipal Safety &amp; Legal Compliance
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl mx-auto text-base text-zinc-400 leading-relaxed">
          Operational framework details for E-Moto Fleet OS in compliance with regional regulations, municipal speed restrictions, and strict data isolation laws.
        </p>
      </section>

      {/* Compliance Information Grid */}
      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 flex flex-col justify-between hover:border-white/[0.1] hover:bg-white/[0.03] transition-all">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] mb-5">
                  {s.icon}
                </span>
                <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Legal Frame Callout */}
        <div className="mt-16 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-accent/[0.04] blur-[80px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl space-y-4 text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-400">
              <ShieldCheck size={12} />
              GDPR &amp; Local Act Compliant
            </span>
            <h2 className="text-xl font-bold text-white">Advanced Data Protection Audits</h2>
            <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
              All E-Moto telemetry channels are protected by rigorous encryption standards matching GDPR definitions and local ICT guidelines. GPS mapping logs undergo cryptographic data minimization, ensuring insurance telemetry claims contain absolute proof of travel scores without leaking exact resident addresses or tracking personal activities outside shifts.
            </p>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
