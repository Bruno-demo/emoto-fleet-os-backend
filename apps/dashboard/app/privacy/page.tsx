'use client';

import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  FileText,
  Lock,
  EyeOff,
  Scale,
} from 'lucide-react';

export default function PrivacyPage() {
  const sections = [
    {
      icon: <Lock size={16} className="text-accent" />,
      title: '1. Telemetry Capture Boundaries',
      content: 'E-Moto systems record precise coordinate streams (GPS), current speed vectors, battery state of charge, operating temperatures, and three-axis accelerometer metrics. Telemetry channels activate exclusively when a rider is checked into an active shift, preventing tracking during private hours.',
    },
    {
      icon: <EyeOff size={16} className="text-rose-400" />,
      title: '2. Cryptographic Minimization',
      content: 'Insurance audit partners receive safety scores and dispatch logs that are cryptographically filtered. Actual household addresses, frequent resting coordinates, and sensitive rider identifiers are removed to protect the privacy of Kigali taxi operators.',
    },
    {
      icon: <Scale size={16} className="text-emerald-400" />,
      title: '3. Data Sharing & Third-Parties',
      content: 'We do not sell telemetry logs. Data is exposed exclusively to verified partner insurance carriers and municipal regulators via scoped, HMAC-signed REST/MQTT interfaces, ensuring data-sharing matches municipal licensing mandates.',
    },
    {
      icon: <FileText size={16} className="text-purple-400" />,
      title: '4. Right to Deletion',
      content: 'Fleet operators and individual riders can request telemetry purging under local data protection laws. Upon approved request, detailed route coordinates older than 90 days are deleted or generalized, preserving only aggregate safety scores.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-accent/[0.04] blur-[100px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <FileText size={12} className="text-accent" />
          Transparency &amp; Legal Framework
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mt-4">
          Privacy Policy
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base text-zinc-400">
          Last updated: May 26, 2026. This policy describes how we collect, minimize, and secure real-time telemetry datasets across the E-Moto Fleet OS platform.
        </p>
      </section>

      {/* Core Privacy Content */}
      <section className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="space-y-10 text-left">
          {sections.map((s, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                {s.icon}
                <h2 className="text-base md:text-lg font-bold text-white">{s.title}</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                {s.content}
              </p>
            </div>
          ))}

          {/* Contact Compliance note */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 mt-10">
            <h3 className="text-xs font-bold text-white">Compliance Inquiries</h3>
            <p className="text-[11px] leading-relaxed text-zinc-500 mt-2">
              For any telemetry access audits or questions about our automated data purging processes, please write to our Data Protection Officer at{' '}
              <a href="mailto:privacy@emoto.rw" className="text-accent hover:underline">
                privacy@emoto.rw
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
