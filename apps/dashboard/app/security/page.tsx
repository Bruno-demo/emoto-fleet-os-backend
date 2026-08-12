'use client';

import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  ShieldCheck,
  Key,
  Lock,
  Server,
  Terminal,
  Activity,
} from 'lucide-react';
import { useTranslation } from '@/components/i18n/LanguageProvider';

export default function SecurityPage() {
  const { t } = useTranslation();

  const standards = [
    {
      icon: <Lock size={18} className="text-accent" />,
      title: t('info_security_sec1_title', 'Encrypted Telemetry Tunnels'),
      desc: t('info_security_sec1_desc', 'All MQTT telemetry payloads and WebSocket map updates are encrypted via TLS 1.3 in transit and stored with AES-256 encryption at rest.'),
    },
    {
      icon: <Key size={18} className="text-emerald-400" />,
      title: t('info_security_sec2_title', 'Role-Based Access Control (RBAC)'),
      desc: t('info_security_sec2_desc', 'Strict role isolation ensures Fleet Admins, Dispatchers, Riders, and Insurers only access data authorized for their exact operational domain.'),
    },
    {
      icon: <Server size={18} className="text-purple-400" />,
      title: 'Isolated Database Tenancy',
      desc: 'Historical tracking records reside in fully segregated TimescaleDB schemas, backed by isolated Redis streams to ensure telemetry metrics do not bleed across operators.',
    },
    {
      icon: <Activity size={18} className="text-amber-400" />,
      title: 'Immutable Audit Logging',
      desc: 'Every remote command, speed rule override, and operator authorization logs into a tamper-proof system audit ledger, tracking exactly who, when, and why an action occurred.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-accent/[0.04] blur-[100px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <ShieldCheck size={12} className="text-accent" />
          {t('info_security_badge', 'Enterprise Security')}
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mt-4">
          {t('info_security_title', 'Platform Infrastructure & Security Overview')}
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base text-zinc-400">
          {t('info_security_subtitle', 'Discover our enterprise encryption standards, TLS telemetry tunnels, automated crash evidence isolation, and role-based access controls.')}
        </p>
      </section>

      {/* Standards Blueprint */}
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {standards.map((s, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 text-left flex gap-4 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                {s.icon}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Blueprint Callout */}
        <div className="mt-12 rounded-2xl border border-white/[0.08] bg-[#09090b] overflow-hidden text-left">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] font-mono text-zinc-500">
            <span className="flex items-center gap-1.5"><Terminal size={12} /> Secure Telemetry Handshake Specs</span>
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
          </div>
          <div className="p-6 font-mono text-[11px] text-zinc-400 space-y-4 overflow-x-auto leading-relaxed">
            <p className="text-accent">{"// TLS 1.3 Cipher Suites Enforced for MQTT Brokers"}</p>
            <p>TLS_AES_256_GCM_SHA384 • ECDHE-RSA-AES256-GCM-SHA384</p>
            
            <p className="text-accent mt-4">{"// Remote Lock JWT Token Claim Structure"}</p>
            <pre className="text-zinc-500">
{`{
  "iss": "emoto-auth-server",
  "sub": "operator-kigali-04",
  "role": "FLEET_ADMIN",
  "action": "TELEMETRY_LOCK",
  "exp": 1786486800
}`}
            </pre>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
