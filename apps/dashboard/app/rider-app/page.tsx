import type { Metadata } from 'next';
import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  Smartphone,
  LocateFixed,
  Siren,
  ShieldCheck,
  BatteryCharging,
  Gauge,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Rider Companion App | BLE Keys & Safety Coaching',
  description: 'Empower drivers with the eMoto Rider app. Includes real-time safety coaching, battery swap station locator, digital Bluetooth key locks, and one-tap emergency SOS dispatch.',
  keywords: [
    'e-moto rider app',
    'Bluetooth motorcycle lock',
    'Kigali battery swap tracker',
    'safe driver coefficient rating',
    'mobile GPS tracker app',
  ],
  alternates: {
    canonical: '/rider-app',
  },
};

export default function RiderAppPage() {
  const features = [
    {
      icon: <LocateFixed size={22} className="text-accent" />,
      title: 'Sub-Second Telemetry Tracking',
      desc: 'Broadcast highly precise positioning, speed, and heading indicators to your fleet command center using minimum data bandwidth.',
    },
    {
      icon: <ShieldCheck size={22} className="text-emerald-400" />,
      title: 'Real-time Safety Coaching',
      desc: 'Receive immediate, friendly dashboard and audio coaching alerts when dangerous behaviors like harsh braking or speeding are detected.',
    },
    {
      icon: <BatteryCharging size={22} className="text-purple-400" />,
      title: 'Battery Swap Locator',
      desc: 'Instantly view nearby charge levels, compatible battery swap stations, and navigate directly to the fastest swap lanes in Kigali.',
    },
    {
      icon: <Siren size={22} className="text-rose-400" />,
      title: 'One-Tap Emergency Dispatch',
      desc: 'Trigger silent SOS alarms or immediate medical dispatch in the event of an incident. Crash indicators automatically capture black-box data.',
    },
    {
      icon: <Gauge size={22} className="text-amber-400" />,
      title: 'Rider Safety Scorecard',
      desc: 'Track your personal weekly safety coefficients, earn regional safe-driver badges, and unlock lower insurance premiums with safe driving.',
    },
    {
      icon: <Smartphone size={22} className="text-blue-400" />,
      title: 'Seamless Digital Keys',
      desc: 'Securely unlock or lock your assigned electric motorcycle via Bluetooth Low Energy (BLE) or encrypted cellular GPRS streams.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-accent/[0.05] blur-[120px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Sparkles size={12} className="text-accent" />
          Rider Companion Experience
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Safety &amp; Intelligence{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400">
            On Every Ride
          </span>
        </h1>
        
        <p className="relative z-10 mt-6 max-w-2xl mx-auto text-base md:text-lg leading-relaxed text-zinc-400">
          Empower your drivers with a companion app that handles secure remote locking, real-time battery swap indicators, and high-performance safety coaching.
        </p>
      </section>

      {/* Main Grid: Info + Phone UI Mockup */}
      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-12 items-center">
          {/* Features Column */}
          <div className="lg:col-span-7 space-y-8">
            <div className="border-b border-white/[0.06] pb-6">
              <h2 className="text-2xl font-bold tracking-tight text-white">Advanced Mobile Infrastructure</h2>
              <p className="text-sm text-zinc-500 mt-2">Built natively for low-latency performance on Android and iOS devices across East African networks.</p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2">
              {features.map((f, i) => (
                <div key={i} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:border-white/[0.1] hover:bg-white/[0.04]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] mb-4 group-hover:bg-white/[0.08] transition">
                    {f.icon}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* High-Fidelity Phone UI mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[340px] rounded-[48px] border-4 border-zinc-800 bg-[#09090b] p-3 shadow-2xl shadow-accent/15 aspect-[9/18]">
              {/* Inner screen content */}
              <div className="h-full w-full rounded-[40px] bg-[#070b14] overflow-hidden flex flex-col justify-between p-5 border border-white/[0.05] relative text-left select-none">
                {/* Status Bar */}
                <div className="flex justify-between items-center text-[10px] font-semibold text-zinc-500">
                  <span>9:41</span>
                  <div className="flex gap-1.5 items-center">
                    <Smartphone size={10} />
                    <span className="h-2 w-3.5 bg-emerald-500 rounded-sm" />
                  </div>
                </div>

                {/* Score Header */}
                <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Driver Score</span>
                    <p className="text-2xl font-extrabold text-white mt-1">94.6<span className="text-xs text-accent">/100</span></p>
                  </div>
                  <div className="h-10 w-10 rounded-full border-2 border-emerald-500 flex items-center justify-center text-[11px] font-bold text-emerald-400">
                    A+
                  </div>
                </div>

                {/* Animated Map Telemetry Card */}
                <div className="flex-1 my-4 rounded-2xl bg-zinc-900/60 border border-white/[0.04] p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 to-purple-500/5" />
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-accent font-bold">Telemetry Live</span>
                      <p className="text-xs font-semibold text-white mt-0.5">KN 78 St, Kigali</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
                  </div>

                  {/* Mock graph line */}
                  <div className="h-16 w-full flex items-end gap-1.5 mt-2">
                    <div className="h-6 w-full bg-white/[0.03] rounded-t-sm" />
                    <div className="h-10 w-full bg-white/[0.03] rounded-t-sm" />
                    <div className="h-14 w-full bg-accent/40 rounded-t-sm" />
                    <div className="h-8 w-full bg-white/[0.03] rounded-t-sm" />
                    <div className="h-12 w-full bg-white/[0.03] rounded-t-sm" />
                    <div className="h-4 w-full bg-white/[0.03] rounded-t-sm" />
                  </div>

                  <div className="relative z-10 flex justify-between items-center text-[9px] text-zinc-500 mt-2 font-mono">
                    <span>Speed: 34 km/h</span>
                    <span>Battery: 72%</span>
                  </div>
                </div>

                {/* Digital Key Controls */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button className="flex-1 py-2.5 rounded-xl bg-accent text-[#070b14] font-bold text-[11px] text-center shadow-sm">
                      Remote Unlock
                    </button>
                    <button className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-zinc-400 font-bold text-[11px] text-center">
                      Arm Security
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-500 text-center">Connected via BLE • SinoTrack Smart Link</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
