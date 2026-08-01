'use client';

import { useState } from 'react';
import {
  Smartphone,
  LocateFixed,
  Siren,
  ShieldCheck,
  BatteryCharging,
  Gauge,
  Sparkles,
  QrCode,
  Camera,
  Lock,
  Unlock,
  CreditCard,
  MapPin,
  CheckCircle2,
  Zap,
  Phone,
  UserCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

type Tab = 'onboarding' | 'controls' | 'momo' | 'stations';

export default function RiderAppPage() {
  const [activeTab, setActiveTab] = useState<Tab>('controls');
  const [isLocked, setIsLocked] = useState(true);
  const [momoPhone, setMomoPhone] = useState('0788123456');
  const [paySuccess, setPaySuccess] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedId, setScannedId] = useState<string | null>(null);

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScannedId('1199880012345012');
    }, 1800);
  };

  const handleMomoPay = () => {
    setPaySuccess(true);
    setTimeout(() => setPaySuccess(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20">
              ⚡
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-tight">eMoto Rider</h1>
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Driver Companion</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-md p-4 space-y-5 pb-24">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-slate-900/80 p-1.5 text-xs font-bold shadow-xl">
          <button
            onClick={() => setActiveTab('controls')}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-all ${
              activeTab === 'controls' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock size={15} />
            <span className="text-[10px]">Digital Key</span>
          </button>

          <button
            onClick={() => setActiveTab('onboarding')}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-all ${
              activeTab === 'onboarding' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode size={15} />
            <span className="text-[10px]">Zero Entry</span>
          </button>

          <button
            onClick={() => setActiveTab('momo')}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-all ${
              activeTab === 'momo' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard size={15} />
            <span className="text-[10px]">Daily Pay</span>
          </button>

          <button
            onClick={() => setActiveTab('stations')}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-all ${
              activeTab === 'stations' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BatteryCharging size={15} />
            <span className="text-[10px]">Swap Lanes</span>
          </button>
        </div>

        {/* TAB 1: DIGITAL KEY & CONTROLS */}
        {activeTab === 'controls' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Assigned Motorcycle Box */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Assigned Vehicle</p>
                  <h2 className="text-lg font-black text-white mt-0.5">TVS HLX 150 • RAD 342 A</h2>
                </div>
                <span className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-400">
                  ID: #863-452
                </span>
              </div>

              {/* Status Indicators */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Battery</p>
                  <p className="text-lg font-black text-emerald-400 mt-1 flex items-center justify-center gap-1">
                    <Zap size={16} /> 84%
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Range</p>
                  <p className="text-lg font-black text-amber-300 mt-1">92 km</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Safety</p>
                  <p className="text-lg font-black text-cyan-400 mt-1">96 / 100</p>
                </div>
              </div>

              {/* Big Bluetooth Digital Key Toggle */}
              <div className="pt-2">
                <button
                  onClick={() => setIsLocked(!isLocked)}
                  className={`w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-black transition-all cursor-pointer shadow-2xl active:scale-95 ${
                    isLocked
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-rose-600/25'
                  }`}
                >
                  {isLocked ? <Unlock size={22} /> : <Lock size={22} />}
                  {isLocked ? 'Tap to Unlock Bike (BLE Key)' : 'Tap to Lock Bike & Arm Security'}
                </button>
                <p className="text-[11px] text-center text-slate-400 mt-2.5 font-medium">
                  {isLocked ? '🔒 Security Armed • GPRS & BLE Active' : '🔓 Unlocked • Ready to Ride'}
                </p>
              </div>
            </div>

            {/* Quick Emergency Button */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                  <Siren size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-white">Emergency SOS Dispatch</h3>
                  <p className="text-[11px] text-slate-400">1-Tap silent alarm to HQ command center</p>
                </div>
              </div>
              <button className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs px-3.5 py-2 cursor-pointer active:scale-95 transition-all">
                SOS
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ZERO MANUAL DATA ENTRY / SELF ONBOARDING */}
        {activeTab === 'onboarding' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400">
                  <Sparkles size={12} />
                  Zero Manual Data Entry
                </span>
                <h2 className="text-lg font-black text-white mt-2">Instant NIDA ID Scanner</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Snap a photo of your Rwandan National ID card. Our AI auto-fills your name, ID number, and profile instantly—no typing required by the fleet owner!
                </p>
              </div>

              {/* ID Scanner Box */}
              <div className="relative rounded-xl border-2 border-dashed border-amber-500/40 bg-slate-950/80 p-6 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                  {isScanning ? <RefreshCw size={28} className="animate-spin" /> : <Camera size={28} />}
                </div>

                {scannedId ? (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full">
                      <CheckCircle2 size={14} /> ID Auto-Extracted Successfully!
                    </div>
                    <p className="text-xs font-mono text-slate-300">NIDA: {scannedId}</p>
                    <p className="text-[11px] text-slate-400">Name: Jean-Paul Habimana • License: Cat. A</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-white">Scan National ID (Indangamuntu)</p>
                    <p className="text-[11px] text-slate-400 mt-1">Place ID inside camera frame to auto-extract</p>
                  </div>
                )}

                <button
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs py-3 transition-all cursor-pointer shadow-md"
                >
                  <Camera size={15} />
                  {isScanning ? 'Extracting Text via AI...' : scannedId ? 'Scan Another Document' : 'Open Camera & Scan ID'}
                </button>
              </div>

              {/* QR Code Share Box */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Fleet Join QR Code</p>
                    <p className="text-[11px] text-slate-400">Show to new riders to instant join</p>
                  </div>
                </div>
                <button className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                  Share QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DAILY MOMO LEASE PAYMENTS */}
        {activeTab === 'momo' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Daily Lease Ledger</p>
                  <h2 className="text-lg font-black text-white mt-0.5">3,000 RWF <span className="text-xs text-slate-400 font-normal">/ day</span></h2>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-400">
                  Due Today
                </span>
              </div>

              {/* MoMo Payment Card */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                    <Phone size={14} /> MTN Mobile Money (RWF)
                  </span>
                  <span className="text-[10px] font-extrabold bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                    MoMo
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">🇷🇼 +250</span>
                  <input
                    type="tel"
                    value={momoPhone}
                    onChange={(e) => setMomoPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-20 pr-4 py-2 text-xs font-bold text-white focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleMomoPay}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs py-3 transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <CreditCard size={15} />
                  Pay 3,000 RWF via MTN MoMo Push
                </button>

                {paySuccess && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 p-3 text-center space-y-1 animate-in fade-in">
                    <p className="text-xs font-extrabold text-emerald-300 flex items-center justify-center gap-1">
                      <CheckCircle2 size={14} /> USSD PIN Prompt Sent!
                    </p>
                    <p className="text-[11px] text-slate-300">Enter your MoMo PIN on your mobile phone to complete payment.</p>
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Recent Transactions</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 border border-white/5">
                    <div>
                      <p className="text-xs font-bold text-white">Daily Lease Payment</p>
                      <p className="text-[10px] text-slate-400">Yesterday • MoMo #98124</p>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-400">3,000 RWF ✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KIGALI BATTERY SWAP LANES */}
        {activeTab === 'stations' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Battery Network</p>
                <h2 className="text-lg font-black text-white mt-0.5">Kigali Swap Stations</h2>
              </div>

              <div className="space-y-2.5">
                {[
                  { name: 'Remera Corner Station', dist: '0.8 km away', batteries: '14 charged', status: 'OPEN' },
                  { name: 'Nyabugogo Bus Park Station', dist: '2.4 km away', batteries: '8 charged', status: 'OPEN' },
                  { name: 'Kimironko Market Hub', dist: '4.1 km away', batteries: '22 charged', status: 'OPEN' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/60 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-white">{s.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.dist} • {s.batteries}</p>
                      </div>
                    </div>
                    <button className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold transition-all">
                      Navigate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
