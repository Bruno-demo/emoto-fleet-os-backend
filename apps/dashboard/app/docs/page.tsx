'use client';

import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  BookOpen,
  Cpu,
  Database,
  Radio,
  FileCode,
  ArrowRight,
  Terminal,
  Settings,
} from 'lucide-react';

export default function DocsPage() {
  const categories = [
    {
      icon: <Radio size={18} className="text-accent" />,
      title: 'GPS Tracker Setup',
      desc: 'SMS and cellular commands to configure SinoTrack ST-901 and MQTT GPRS devices to report back to Fleet OS systems.',
    },
    {
      icon: <Cpu size={18} className="text-emerald-400" />,
      title: 'MQTT Broker Integration',
      desc: 'Subscribe to high-volume JSON telemetry streams, handle device commands, and monitor hardware network levels.',
    },
    {
      icon: <FileCode size={18} className="text-purple-400" />,
      title: 'REST API & Methods',
      desc: 'Authorize using secure OAuth2 credentials, query active fleet coordinates, and trigger remote commands programmatically.',
    },
    {
      icon: <Database size={18} className="text-amber-400" />,
      title: 'Partner API & Webhooks',
      desc: 'Export structured data securely to insurance systems and regulators via HMAC-signed real-time webhooks.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-accent/[0.04] blur-[100px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <BookOpen size={12} className="text-accent" />
          Technical &amp; Developer Guides
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mt-4">
          Developer &amp; Operations Center
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base text-zinc-400">
          Everything you need to configure GPS trackers, connect telemetry pipelines, customize dispatch actions, and query partner APIs.
        </p>
      </section>

      {/* Docs Grid */}
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Sidebar Directory */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Getting Started</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#sinotrack" className="block text-accent font-semibold transition hover:text-white">SinoTrack SMS Setup</a>
              </li>
              <li>
                <a href="#mqtt" className="block text-zinc-400 transition hover:text-white">MQTT Broker Config</a>
              </li>
              <li>
                <a href="#rest-api" className="block text-zinc-400 transition hover:text-white">REST API Integration</a>
              </li>
              <li>
                <a href="#webhooks" className="block text-zinc-400 transition hover:text-white">Webhooks &amp; HMAC</a>
              </li>
            </ul>

            <div className="pt-6 border-t border-white/[0.06] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">APIs Reference</h3>
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                <span className="text-[10px] uppercase font-bold text-accent">Active Version</span>
                <p className="text-xs text-white font-mono mt-1">v1.2.0-stable</p>
              </div>
            </div>
          </div>

          {/* Docs Core Content */}
          <div className="lg:col-span-9 space-y-16 text-left">
            {/* Intro Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {categories.map((c, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04]">
                      {c.icon}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-500">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* Guide Section 1: SinoTrack Setup */}
            <div id="sinotrack" className="space-y-6 scroll-mt-20 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Terminal size={20} className="text-accent" />
                <h2 className="text-xl font-bold text-white">SinoTrack ST-901 Configuration</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                To connect a standard SinoTrack ST-901 GPRS module to the E-Moto network, configure the cellular APN and point GPRS transmission to our gateway stream-processor port. SMS commands must be sent directly to the SIM card installed on the device.
              </p>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Configuration SMS commands (MTN Rwanda APN)</span>
                  <span>SMS Format</span>
                </div>
                <div className="p-4 font-mono text-xs text-zinc-300 space-y-2 leading-relaxed font-semibold">
                  <p><span className="text-accent">1. APN setting:</span> <code className="text-white bg-white/[0.04] px-1.5 py-0.5 rounded">8020000 internet.rw</code></p>
                  <p><span className="text-accent">2. Network server domain:</span> <code className="text-white bg-white/[0.04] px-1.5 py-0.5 rounded">8040000 tracker.emoto.rw 5431</code></p>
                  <p><span className="text-accent">3. Telemetry interval (20s):</span> <code className="text-white bg-white/[0.04] px-1.5 py-0.5 rounded">8050000 20</code></p>
                </div>
              </div>
            </div>

            {/* Guide Section 2: MQTT Broker API */}
            <div id="mqtt" className="space-y-6 scroll-mt-20 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-emerald-400" />
                <h2 className="text-xl font-bold text-white">MQTT Broker Telemetry Integration</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Fleet OS runs a highly available EMQX cluster optimized for real-time telemetry extraction. High-fidelity clients (e.g. smart batteries or custom IoT boards) report telemetry via JSON payloads over secure TLS channels.
              </p>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Topic Schema: devices/+/telemetry</span>
                  <span>JSON Payload</span>
                </div>
                <pre className="p-4 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
{`{
  "deviceUid": "sinotrack-901-kigali-0024",
  "timestamp": 1779893922000,
  "telemetry": {
    "latitude": -1.9441,
    "longitude": 30.0619,
    "speedKph": 42.5,
    "batteryVoltage": 74.2,
    "soc": 84,
    "accelerometer": { "x": 0.04, "y": -0.01, "z": 0.98 }
  }
}`}
                </pre>
              </div>
            </div>

            {/* Guide Section 3: REST API Integration */}
            <div id="rest-api" className="space-y-6 scroll-mt-20 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <FileCode size={20} className="text-purple-400" />
                <h2 className="text-xl font-bold text-white">REST API Integration &amp; Authentication</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Integrate E-Moto Fleet OS metrics directly into your custom mobile portals, ERP systems, or underwriting algorithms. Access tokens are requested securely via client secrets.
              </p>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Retrieve Scoped Access Token</span>
                  <span>cURL Command</span>
                </div>
                <pre className="p-4 font-mono text-xs text-purple-400 overflow-x-auto leading-relaxed">
{`curl -X POST https://api.emoto.rw/partner/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientId": "partner-demo-client",
    "clientSecret": "PartnerSecret123!"
  }'`}
                </pre>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Execute Remote Telemetry Command</span>
                  <span>Node.js / Axios integration sample</span>
                </div>
                <pre className="p-4 font-mono text-xs text-purple-400 overflow-x-auto leading-relaxed">
{`import axios from 'axios';

async function lockElectricBike(deviceUid) {
  try {
    const response = await axios.post(
      'https://api.emoto.rw/partner/commands',
      {
        deviceUid: deviceUid,
        command: 'RELAY_DISABLE' // engine cutoff
      },
      {
        headers: {
          Authorization: 'Bearer PARTNER_ACCESS_TOKEN'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Command dispatch failed:', error.message);
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
