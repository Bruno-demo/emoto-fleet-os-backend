import type { Metadata } from 'next';
import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  BookOpen,
  Cpu,
  Radio,
  FileCode,
  Terminal,
  Shield,
  Coins,
  Key,
  Flame,
  Activity,
  Layers,
  CheckCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation & Developer API Reference | eMoto Fleet OS',
  description: 'Read our comprehensive developer manuals: SinoTrack ST-901 SMS programming, MQTT TLS ingest specs, OAuth2 client auth, REST endpoints, and daily collections ledger guide.',
  keywords: [
    'SinoTrack ST-901 SMS configuration',
    'MQTT broker broker.emotofleet.com',
    'eMoto API reference',
    'TLS 1.3 telemetry cipher suites',
    'lease billing ledger API',
  ],
  alternates: {
    canonical: '/docs',
  },
};

export default function DocsPage() {
  const categories = [
    {
      icon: <Layers size={18} className="text-accent" />,
      title: 'Use Cases & Platform',
      desc: 'Learn about real-time telemetry, driver safety scoring, geofenced compliance, and micro-insurance integrations.',
    },
    {
      icon: <Coins size={18} className="text-emerald-400" />,
      title: 'Pricing & Subscriptions',
      desc: 'Compare the Safety Core and Operations Plus tiers, and understand the device setup and active bike costs.',
    },
    {
      icon: <Key size={18} className="text-amber-400" />,
      title: 'Lock & Unlock Guide',
      desc: 'Understand remote command safety interlocks, over-the-air command dispatches, and emergency HQ overrides.',
    },
    {
      icon: <Activity size={18} className="text-rose-400" />,
      title: 'Financials & Operations',
      desc: 'Use the weekly collection matrix, manage rider lease payments, track arrears, and export logs to CSV.',
    },
    {
      icon: <Radio size={18} className="text-blue-400" />,
      title: 'SinoTrack SMS Setup',
      desc: 'Cellular commands to program SinoTrack ST-901 trackers to transmit data directly to Fleet OS ingest gateways.',
    },
    {
      icon: <Cpu size={18} className="text-purple-400" />,
      title: 'MQTT & Developer API',
      desc: 'Authorize using OAuth2 credentials, subscribe to telemetry JSON streams, and programmatically query metrics.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-accent/[0.04] blur-[100px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <BookOpen size={12} className="text-accent" />
          Technical &amp; Operations Center
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mt-4">
          Documentation &amp; User Manual
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base text-zinc-400">
          Complete guide to configure hardware trackers, command active vehicle relays, handle daily collections, and query developer APIs.
        </p>
      </section>

      {/* Docs Grid */}
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Sidebar Directory */}
          <div className="lg:col-span-3">
            <div className="sticky top-24 space-y-6 text-left">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Core Manual</h3>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <a href="#use-cases" className="block text-zinc-400 transition hover:text-white">Use Cases &amp; Scope</a>
                  </li>
                  <li>
                    <a href="#subscriptions" className="block text-zinc-400 transition hover:text-white">Subscription Comparison</a>
                  </li>
                  <li>
                    <a href="#lock-unlock" className="block text-zinc-400 transition hover:text-white">Lock &amp; Unlock Controls</a>
                  </li>
                  <li>
                    <a href="#operations" className="block text-zinc-400 transition hover:text-white">Operations &amp; Financials</a>
                  </li>
                </ul>
              </div>

              <div className="pt-6 border-t border-white/[0.06]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Technical Reference</h3>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <a href="#sinotrack" className="block text-zinc-400 transition hover:text-white">SinoTrack SMS Setup</a>
                  </li>
                  <li>
                    <a href="#mqtt" className="block text-zinc-400 transition hover:text-white">MQTT Broker Ingest</a>
                  </li>
                  <li>
                    <a href="#rest-api" className="block text-zinc-400 transition hover:text-white">REST API Integration</a>
                  </li>
                </ul>
              </div>

              <div className="pt-6 border-t border-white/[0.06] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">APIs Version</h3>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                  <span className="text-[10px] uppercase font-bold text-accent">Active Version</span>
                  <p className="text-xs text-white font-mono mt-1">v1.2.0-stable</p>
                </div>
              </div>
            </div>
          </div>

          {/* Docs Core Content */}
          <div className="lg:col-span-9 space-y-16 text-left">
            {/* Intro Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {categories.map((c, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 hover:border-white/[0.1] hover:bg-white/[0.02] transition-all">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
                      {c.icon}
                    </span>
                    <h3 className="text-xs font-bold text-white">{c.title}</h3>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* Guide Section 1: Use Cases */}
            <div id="use-cases" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Layers size={20} className="text-accent" />
                <h2 className="text-xl font-bold text-white">1. Platform Scope &amp; Use Cases</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                E-Moto Fleet OS is a robust IoT telemetry and operations command center built to manage and secure massive electric motorcycle fleets. The system maps hardware inputs directly to operational capabilities:
              </p>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="rounded-lg bg-white/[0.02] p-4 border border-white/[0.04]">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Flame size={14} className="text-rose-400" /> Micro-Insurance Safety Underwriting
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                    By monitoring real-time accelerometer coordinates and speed limits, the system logs speed violations and hard braking events. These telemetry logs generate weekly safety ratings, enabling insurance providers to underwrite safer riders at lower premiums.
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.02] p-4 border border-white/[0.04]">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Shield size={14} className="text-blue-400" /> Municipal Slow-Zone Compliance
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                    Set geofences around schools, hospitals, and busy transit hubs. Telemetry integrations track if riders exceed the maximum municipal limits inside slow zones and alert operators immediately of geofence breaches.
                  </p>
                </div>
              </div>
            </div>

            {/* Guide Section 2: Subscriptions */}
            <div id="subscriptions" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Coins size={20} className="text-emerald-400" />
                <h2 className="text-xl font-bold text-white">2. Subscription Tiers Comparison</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Manage your operations budget with transparent subscriptions. E-Moto charges a one-time device provisioning fee followed by monthly software subscriptions per active bike:
              </p>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#09090b]">
                <table className="w-full border-collapse text-left text-xs md:text-sm text-zinc-400">
                  <thead className="border-b border-white/[0.08] bg-white/[0.02] text-xs font-bold text-white">
                    <tr>
                      <th className="p-4">Feature / Metric</th>
                      <th className="p-4">Safety Core Plan</th>
                      <th className="p-4">Operations Plus Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    <tr>
                      <td className="p-4 font-semibold text-white">Monthly Active Cost</td>
                      <td className="p-4">5,000 RWF / bike</td>
                      <td className="p-4">10,000 RWF / bike</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">One-Time Setup Fee</td>
                      <td className="p-4">30,000 RWF / bike (Device installation)</td>
                      <td className="p-4">30,000 RWF / bike (Device installation)</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Realtime Telemetry</td>
                      <td className="p-4">GPS Tracking, Speed &amp; State</td>
                      <td className="p-4">GPS Tracking, Speed &amp; State</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">OTA Starter Relays</td>
                      <td className="p-4">Remote Lock &amp; Unlock Enabled</td>
                      <td className="p-4">Remote Lock &amp; Unlock Enabled</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Financial Matrix Ledger</td>
                      <td className="p-4 text-zinc-600">Unavailable</td>
                      <td className="p-4 text-emerald-400">Weekly Matrix, Aggregates &amp; Arrears</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Export &amp; Analytics</td>
                      <td className="p-4">Basic logs</td>
                      <td className="p-4">Excel/CSV Data Export &amp; Custom Splines</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Developer Integration</td>
                      <td className="p-4 text-zinc-600">Unavailable</td>
                      <td className="p-4">MQTT Telemetry, Scoped REST API, HMAC Webhooks</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guide Section 3: Lock/Unlock */}
            <div id="lock-unlock" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Key size={20} className="text-amber-400" />
                <h2 className="text-xl font-bold text-white">3. Remote Lock &amp; Unlock Controls</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                To immobilize a non-compliant or stolen motorcycle, operators can dispatch remote over-the-air commands. The platform enforces strict security checks before activating starter cutoff relays:
              </p>
              
              <div className="space-y-4">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
                  <h4 className="text-xs font-bold text-white">Command Verification Rules</h4>
                  <ul className="list-disc list-inside mt-3 text-xs text-zinc-500 space-y-2 leading-relaxed">
                    <li><strong className="text-zinc-300">Stationary Checks:</strong> Lock commands are blocked by the safety engine if the telemetry stream indicates speed &gt; 0 Kph or active G-Force vectors, avoiding accidents.</li>
                    <li><strong className="text-zinc-300">Ignition Relay:</strong> A Lock command pulls the physical ignition line low (engine cutoff). An Unlock command pulls the line high, returning starting control back to the ignition key.</li>
                    <li><strong className="text-zinc-300">HQ Admin Override:</strong> Super Admins can bypass typical fleet ownership restrictions to command and recover stolen vehicles from the HQ Control panel.</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.02] p-4 text-xs text-yellow-400 leading-relaxed">
                  <strong>Safety Notice:</strong> Always confirm the vehicle state via live maps before issuing starter cutoff overrides. Lock commands take up to 5 seconds to propagate over GPRS cellular data.
                </div>
              </div>
            </div>

            {/* Guide Section 4: Operations & Financials */}
            <div id="operations" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Activity size={20} className="text-rose-400" />
                <h2 className="text-xl font-bold text-white">4. Operations &amp; Financial Ledger</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                The Operations Plus tier unlocks the high-fidelity billing control desk. Fleet operators can track lease transactions, capture arrears, and audit rider payments:
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-white/[0.02] p-4 border border-white/[0.04]">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-400" /> Weekly Payment Grid
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                    Displays each rider against operational week days. Checkmarks represent paid shifts, while red tags highlight outstanding dues. Clicking any day opens the Collection ledger modal.
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.02] p-4 border border-white/[0.04]">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-400" /> Payments Ledger &amp; Form
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                    Record collections (default 15,000 RWF lease rate per shift) using Mobile Money references, Cash receipts, or Bank Transfer codes. Records are cryptographically logged to preventing tempering.
                  </p>
                </div>
              </div>
            </div>

            {/* Guide Section 5: SinoTrack SMS Setup */}
            <div id="sinotrack" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Terminal size={20} className="text-blue-400" />
                <h2 className="text-xl font-bold text-white">5. SinoTrack ST-901 SMS Programming</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                To route hardware telemetry coordinates from a SinoTrack ST-901 or compatible GPRS module to the E-Moto network, send the following SMS codes directly to the installed SIM card number:
              </p>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Configuration Steps (MTN Rwanda Cellular Network)</span>
                  <span>SMS Code Format</span>
                </div>
                <div className="p-4 font-mono text-xs text-zinc-300 space-y-2.5 leading-relaxed font-semibold">
                  <p><span className="text-blue-400">1. Admin Number Registration:</span> <code className="text-white bg-white/[0.04] px-1.5 py-0.5 rounded">admin123456 +250788000000</code></p>
                  <p><span className="text-blue-400">2. Cellular APN Configuration:</span> <code className="text-white bg-white/[0.04] px-1.5 py-0.5 rounded">8020000 internet.rw</code></p>
                  <p><span className="text-blue-400">3. Ingest Host Target &amp; Port:</span> <code className="text-white bg-white/[0.04] px-1.5 py-0.5 rounded">8040000 tracker.emotofleet.com 5431</code></p>
                  <p><span className="text-blue-400">4. Telemetry Update Interval (20s):</span> <code className="text-white bg-white/[0.04] px-1.5 py-0.5 rounded">8050000 20</code></p>
                </div>
              </div>
            </div>

            {/* Guide Section 6: MQTT Ingest */}
            <div id="mqtt" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Cpu size={20} className="text-purple-400" />
                <h2 className="text-xl font-bold text-white">6. MQTT Telemetry Broker Configuration</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Custom IoT modules and smart battery management boards report high-fidelity JSON telemetry records directly to our TLS-secured MQTT cluster:
              </p>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Downlink Topic: devices/&#123;deviceUid&#125;/command</span>
                  <span>MQTT Broker Host: mqtt.emotofleet.com:8883</span>
                </div>
                <pre className="p-4 font-mono text-xs text-purple-400 overflow-x-auto leading-relaxed">
{`{
  "deviceUid": "st-901-kigali-0849",
  "timestamp": 1779893922000,
  "telemetry": {
    "latitude": -1.94412,
    "longitude": 30.06191,
    "speedKph": 0.0,
    "batteryVoltage": 72.8,
    "soc": 68,
    "accelerometer": { "x": 0.02, "y": 0.0, "z": 0.99 }
  }
}`}
                </pre>
              </div>
            </div>

            {/* Guide Section 7: REST API */}
            <div id="rest-api" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <FileCode size={20} className="text-accent" />
                <h2 className="text-xl font-bold text-white">7. REST Developer API Reference</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Automate operations or pull safety rating aggregates using the scoped REST API. Secure requests must be authenticated using OAuth2 client tokens:
              </p>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Authenticate &amp; Retrieve Token</span>
                  <span>cURL Command</span>
                </div>
                <pre className="p-4 font-mono text-xs text-accent overflow-x-auto leading-relaxed">
{`curl -X POST https://gateway.emotofleet.com/partner/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientId": "partner-active-client",
    "clientSecret": "SecurePartnerToken2026!"
  }'`}
                </pre>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-zinc-500">
                  <span>Dispatch Over-The-Air command</span>
                  <span>Node.js / Axios Sample</span>
                </div>
                <pre className="p-4 font-mono text-xs text-accent overflow-x-auto leading-relaxed">
{`import axios from 'axios';

async function lockElectricBike(deviceUid) {
  try {
    const response = await axios.post(
      'https://gateway.emotofleet.com/partner/commands',
      {
        deviceUid: deviceUid,
        command: 'RELAY_DISABLE' // immobilize vehicle
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
