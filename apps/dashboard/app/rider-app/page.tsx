'use client';

import {
  Smartphone,
  ShieldCheck,
  Download,
  QrCode,
  Sparkles,
  Lock,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export default function RiderAppPage() {
  const expoLanUrl = 'exp://192.168.1.118:8082';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white font-sans selection:bg-accent selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-[#0F172A]/80 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-white font-black text-base shadow-lg shadow-accent/25 transition group-hover:scale-105">
              ⚡
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white leading-none">eMoto Rider</h1>
              <p className="text-[10px] font-extrabold text-accent uppercase tracking-widest mt-0.5">Native React Native Mobile App</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Expo Dev Server Active (Port 8082)
            </span>
            <Link
              href="/overview"
              className="rounded-xl border border-line bg-surface hover:bg-surface-hover px-4 py-2 text-xs font-bold text-ink-soft transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-4 py-1.5 text-xs font-extrabold text-accent">
            <Sparkles size={14} /> Official React Native App
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            The Native Mobile App For Moto Riders 🇷🇼
          </h1>
          <p className="text-ink-soft text-sm md:text-base leading-relaxed">
            Built with React Native &amp; Expo for iOS and Android. Zero manual data entry for fleet managers—riders scan National IDs, unlock motorcycles via Bluetooth BLE, and pay daily leases via MTN MoMo.
          </p>
        </section>

        {/* Expo Go & Mobile Download Card */}
        <section className="grid gap-6 md:grid-cols-12 items-center rounded-3xl border border-accent/30 bg-gradient-to-b from-accent/10 via-[#0F172A]/90 to-[#0B0F19] p-8 shadow-2xl shadow-accent/5">
          <div className="md:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-accent text-white font-black text-xs px-3 py-1 uppercase tracking-wider shadow-md shadow-accent/20">
              📱 Live Expo / Mobile Build
            </div>
            <h2 className="text-2xl font-black text-white">Connect via Expo Go or Download APK</h2>
            <p className="text-xs text-ink-soft leading-relaxed">
              Open Expo Go on your mobile phone and scan the LAN URL below to launch the React Native rider application instantly on your device:
            </p>

            {/* Expo URL Code Block */}
            <div className="rounded-xl border border-accent/40 bg-[#070B14] p-4 space-y-2 font-mono">
              <div className="flex items-center justify-between text-[11px] text-ink-muted font-bold uppercase">
                <span>Expo Go Mobile URL</span>
                <span className="text-accent">REACT NATIVE</span>
              </div>
              <p className="text-sm font-bold text-accent select-all">{expoLanUrl}</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={expoLanUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-accent hover:bg-accent-strong text-white font-extrabold text-xs px-5 py-3 transition-all shadow-lg shadow-accent/25 active:scale-95"
              >
                <Smartphone size={16} /> Open in Expo Go <ExternalLink size={14} />
              </a>

              <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-white font-extrabold text-xs px-5 py-3 transition-all cursor-pointer">
                <Download size={16} /> Download Android APK (.apk)
              </button>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-[#070B14]/80 border border-line text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent">
              <QrCode size={36} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Scan with Phone Camera</h3>
              <p className="text-xs text-ink-muted mt-1">Open Expo Go on Android or iOS to load app bundle</p>
            </div>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1 rounded-full">
              Status: Metro Bundler Ready
            </span>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-[#0F172A]/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-base font-extrabold text-white">AI National ID Scanner</h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Riders snap their Rwandan Indangamuntu. AI extracts NIDA number and name instantly—zero manual entry for fleet managers.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-[#0F172A]/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <Lock size={20} />
            </div>
            <h3 className="text-base font-extrabold text-white">1-Tap Bluetooth Key</h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Lock and unlock electric motorcycles directly from smartphone over BLE or cellular telemetry streams.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-[#0F172A]/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <CreditCard size={20} />
            </div>
            <h3 className="text-base font-extrabold text-white">MTN MoMo Daily Lease Pay</h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              One-click daily rental payment triggers an instant USSD PIN push directly to the rider&apos;s MTN wallet.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
