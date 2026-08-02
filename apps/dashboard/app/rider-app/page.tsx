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
  const expoLanUrl = 'exp://192.168.18.4:8082';

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black text-base shadow-lg shadow-amber-500/20">
              ⚡
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white leading-none">eMoto Rider</h1>
              <p className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest mt-0.5">Native React Native Mobile App</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Expo Dev Server Active (Port 8082)
            </span>
            <Link
              href="/live"
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 transition-all"
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
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-4 py-1.5 text-xs font-extrabold text-amber-400">
            <Sparkles size={14} /> Official React Native App
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            The Native Mobile App For Moto Riders 🇷🇼
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Built with React Native &amp; Expo for iOS and Android. Zero manual data entry for fleet managers—riders scan National IDs, unlock motorcycles via Bluetooth BLE, and pay daily leases via MTN MoMo.
          </p>
        </section>

        {/* Expo Go & Mobile Download Card */}
        <section className="grid gap-6 md:grid-cols-12 items-center rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-slate-900/90 to-slate-950 p-8 shadow-2xl">
          <div className="md:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-amber-400 text-slate-950 font-black text-xs px-3 py-1 uppercase tracking-wider">
              📱 Live Expo / Mobile Build
            </div>
            <h2 className="text-2xl font-black text-white">Connect via Expo Go or Download APK</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Open Expo Go on your mobile phone and scan the LAN URL below to launch the React Native rider application instantly on your device:
            </p>

            {/* Expo URL Code Block */}
            <div className="rounded-xl border border-amber-500/40 bg-slate-950 p-4 space-y-2 font-mono">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase">
                <span>Expo Go Mobile URL</span>
                <span className="text-amber-400">REACT NATIVE</span>
              </div>
              <p className="text-sm font-bold text-amber-300 select-all">{expoLanUrl}</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={expoLanUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 py-3 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <Smartphone size={16} /> Open in Expo Go <ExternalLink size={14} />
              </a>

              <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs px-5 py-3 transition-all cursor-pointer">
                <Download size={16} /> Download Android APK (.apk)
              </button>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/80 border border-white/10 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <QrCode size={36} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Scan with Phone Camera</h3>
              <p className="text-xs text-slate-400 mt-1">Open Expo Go on Android or iOS to load app bundle</p>
            </div>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full">
              Status: Metro Bundler Ready
            </span>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-base font-extrabold text-white">AI National ID Scanner</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Riders snap their Rwandan Indangamuntu. AI extracts NIDA number and name instantly—zero manual entry for fleet managers.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Lock size={20} />
            </div>
            <h3 className="text-base font-extrabold text-white">1-Tap Bluetooth Key</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lock and unlock electric motorcycles directly from smartphone over BLE or cellular telemetry streams.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <CreditCard size={20} />
            </div>
            <h3 className="text-base font-extrabold text-white">MTN MoMo Daily Lease Pay</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              One-click daily rental payment triggers an instant USSD PIN push directly to the rider&apos;s MTN wallet.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
