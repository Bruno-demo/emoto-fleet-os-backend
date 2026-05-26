'use client';

import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  Globe,
  Trees,
  Shield,
  Zap,
  ArrowRight,
  TrendingUp,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const values = [
    {
      icon: <Shield size={18} className="text-accent" />,
      title: 'Safety First Approach',
      desc: 'Reducing accidents by using active, sub-second telemetry sensors and smart algorithms rather than just reacting to them afterwards.',
    },
    {
      icon: <Zap size={18} className="text-amber-400" />,
      title: 'High Performance Telemetry',
      desc: 'Hardware-agnostic platform supporting MQTT and cellular streams for optimal GPS stability across various device vendors.',
    },
    {
      icon: <Trees size={18} className="text-emerald-400" />,
      title: 'Decarbonizing Local Cities',
      desc: 'Providing robust infrastructure to accelerate the transition to electric two-wheelers in East Africa, lowering regional carbon metrics.',
    },
  ];

  const milestones = [
    { label: 'Active Connected Bikes', value: '1,284+' },
    { label: 'Incident Resolution Rate', value: '96%' },
    { label: 'Avg Emergency Dispatch', value: '< 2.5 min' },
    { label: 'Estimated CO2 Saved', value: '450 Tons' },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-accent/[0.04] blur-[120px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Globe size={12} className="text-accent" />
          Our Mission &amp; Vision
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight mt-4">
          Safe, Clean, and Smart{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-emerald-400">
            Urban Mobility
          </span>
        </h1>
        <p className="relative z-10 mt-6 max-w-2xl mx-auto text-base md:text-lg leading-relaxed text-zinc-400">
          E-Moto Fleet OS was built to address critical fleet safety, real-time command, and battery utilization challenges for electric motorcycle operations across East Africa.
        </p>
      </section>

      {/* Pillars and Milestones */}
      <section className="mx-auto w-full max-w-7xl px-6 py-12 space-y-20">
        {/* Core values */}
        <div className="grid gap-8 md:grid-cols-3">
          {values.map((v, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] mb-4">
                {v.icon}
              </span>
              <h3 className="text-base font-semibold text-white">{v.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Milestones grid */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.01] p-8">
          <div className="flex flex-col items-center text-center gap-2 mb-10">
            <span className="inline-flex items-center gap-1.5 text-xs text-accent font-semibold">
              <TrendingUp size={14} /> E-Moto Metrics
            </span>
            <h2 className="text-2xl font-bold text-white">Platform Progress by the Numbers</h2>
          </div>
          
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-4 text-center">
            {milestones.map((m, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <p className="text-3xl md:text-4xl font-extrabold text-white">{m.value}</p>
                <p className="text-xs text-zinc-500 mt-2">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Kigali context vision */}
        <div className="grid gap-8 md:grid-cols-2 items-center border-t border-white/[0.06] pt-16">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Electric Fleet Innovation in East Africa</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Traditional motorcycle taxi and courier networks rely heavily on expensive petrol engines with zero safety monitoring. E-Moto is bridging the gap by equipping fleet managers with hardware-agnostic tracking systems, preventing accidents before they occur, and optimizing battery depletion cycles.
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">
              Through scoped API platforms and strict municipal boundaries, E-Moto Fleet OS ensures regulatory compliance, transparent driver scores, and clean-energy transitions in Rwanda and beyond.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 flex flex-col justify-between aspect-video relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-emerald-500/[0.04] blur-[80px] rounded-full pointer-events-none" />
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Kigali Headquarters</span>
              <Activity size={20} className="text-emerald-400 animate-pulse-soft" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">E-Moto Mobility Lab</p>
              <p className="text-[11px] text-zinc-500 mt-1">KN 78 St, Kigali, Rwanda</p>
            </div>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
