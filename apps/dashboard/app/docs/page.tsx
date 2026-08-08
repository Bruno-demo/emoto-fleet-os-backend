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
  Lock,
  Settings,
  DollarSign,
  MapPin,
  Users,
  Smartphone,
  UserCheck,
  Globe,
  AlertOctagon,
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
      desc: 'Compare Cooperative & Individual and Delivery Fleet plans, with 0 RWF hardware setup fees.',
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
                <ul className="space-y-2.5 text-xs md:text-sm">
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">SaaS User Guide</h3>
                <ul className="space-y-2.5 text-xs md:text-sm">
                  <li>
                    <a href="#saas-user-guide" className="block text-zinc-400 transition hover:text-white">Platform Screen Guide</a>
                  </li>
                </ul>
              </div>

              <div className="pt-6 border-t border-white/[0.06]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Technical Reference</h3>
                <ul className="space-y-2.5 text-xs md:text-sm">
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
                      <th className="p-4">Cooperative & Individual Plan</th>
                      <th className="p-4">Delivery Fleet Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    <tr>
                      <td className="p-4 font-semibold text-white">Monthly Rate Per Bike</td>
                      <td className="p-4">10,000 RWF / bike</td>
                      <td className="p-4">15,000 RWF / bike</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Device Setup Fee</td>
                      <td className="p-4">0 RWF (eMoto company property)</td>
                      <td className="p-4">0 RWF (eMoto company property)</td>
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
                    <li><strong className="text-zinc-300">Stationary Checks:</strong> Lock commands are blocked by the safety engine if the telemetry stream indicates speed &gt; 0 KM/H or active G-Force vectors, avoiding accidents.</li>
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
                The financial &amp; billing control desk allows fleet operators to track lease transactions, capture arrears, and audit rider payments:
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

            {/* --- SaaS Screen-by-Screen User Guide --- */}
            <div id="saas-user-guide" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <BookOpen size={20} className="text-zinc-400" />
                <h2 className="text-xl font-bold text-white">SaaS Screen-by-Screen User Guide</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Detailed guides for each screen in the eMoto Fleet OS dashboard, detailing their operational purpose, key actions, troubleshooting, and best practices.
              </p>
            </div>

            {/* 1. Landing & Auth */}
            <div id="guide-auth" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Lock size={20} className="text-zinc-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 1: Authentication &amp; Onboarding</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                The entry portal ensures all users log in securely, choose the correct roles, or register a new fleet profile on the system.
              </p>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
                  <h4 className="text-xs font-bold text-white">Key Operator Actions</h4>
                  <ul className="list-disc list-inside mt-3 text-xs text-zinc-500 space-y-2 leading-relaxed">
                    <li><strong>Account Login:</strong> Input your registered email and password to receive an auth token cookie.</li>
                    <li><strong>Fleet Registration:</strong> Enter fleet company name, commercial license scan, primary phone, and choose standard or insurer billing plans.</li>
                    <li><strong>Password Reset:</strong> Trigger a secure reset link if you lose credentials.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-red-500/10 bg-red-500/[0.01] p-5 text-xs text-zinc-500 leading-relaxed">
                  <strong className="text-red-400 block mb-2">Common Errors:</strong>
                  <p className="mb-2">⚠️ <strong>&quot;Invalid Credentials&quot;:</strong> Check for leading spaces in the email. Passwords require a capital letter, a number, and a symbol.</p>
                  <p>⚠️ <strong>&quot;Account Pending HQ Verification&quot;:</strong> Newly registered fleets are locked until approved by the eMoto HQ admin team.</p>
                </div>
              </div>
            </div>

            {/* 2. Fleet Overview */}
            <div id="guide-overview" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Layers size={20} className="text-accent" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 2: Fleet Overview Dashboard</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Your daily operational command room. Get a high-level summary of active vehicles, driver safety profiles, battery state alerts, and crash warnings.
              </p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
                <h4 className="text-xs font-bold text-white">Main KPI Cards</h4>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-xs">
                  <div className="p-3 bg-white/[0.02] rounded-md border border-white/[0.04]">
                    <span className="text-zinc-500">Active Bikes</span>
                    <p className="text-lg font-bold text-white mt-1">92%</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-md border border-white/[0.04]">
                    <span className="text-zinc-500">Active Riders</span>
                    <p className="text-lg font-bold text-white mt-1">48 / 52</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-md border border-white/[0.04]">
                    <span className="text-zinc-500">Avg Safety Score</span>
                    <p className="text-lg font-bold text-emerald-400 mt-1">84.2</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-md border border-white/[0.04]">
                    <span className="text-zinc-500">Pending Incidents</span>
                    <p className="text-lg font-bold text-rose-500 mt-1">0</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed pt-2">
                  <strong>Pro-Tip:</strong> The telemetry data stream automatically updates every 10 seconds. You can force a manual interface sync by clicking the refresh icon next to the date filter.
                </p>
              </div>
            </div>

            {/* 3. Live Map & Tracking */}
            <div id="guide-live" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-blue-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 3: Live Map &amp; GPS Tracking</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Monitor vehicle locations in real-time on Kigali&apos;s streets. The map aggregates traffic signs, speed warnings, and school boundaries to flag risky driver behavior.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
                  <h4 className="text-xs font-bold text-white">Available Map Controls</h4>
                  <ul className="list-disc list-inside mt-3 text-xs text-zinc-500 space-y-2 leading-relaxed">
                    <li><strong>Auto-Center:</strong> Click any vehicle plate in the sidebar directory to zoom and snap the map layout onto its GPS point.</li>
                    <li><strong>Road Context Overlay:</strong> Toggle the &quot;Road Context&quot; switch to display local safety hazards (schools, market crossings, speed signs) on the canvas.</li>
                    <li><strong>Relay Immobilization:</strong> Select an active bike, click the Lock command, and enter password validation to cut the starter ignition relay.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 text-xs text-zinc-500 leading-relaxed">
                  <strong className="text-white block mb-2">Troubleshooting Pins:</strong>
                  <p className="mb-2">🔴 <strong>Red Pin:</strong> Active crash warning or critical battery level (&lt; 15%).</p>
                  <p className="mb-2">⚪ <strong>Grey Pin (Offline):</strong> Tracker is powered off, out of cell service, or has a disconnected battery.</p>
                  <p>🟢 <strong>Green Pin:</strong> Active tracking transmitting standard coordinates.</p>
                </div>
              </div>
            </div>

            {/* 4. Bike Inventory */}
            <div id="guide-bikes" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Layers size={20} className="text-amber-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 4: Bike Inventory Directory</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Register, edit, and keep track of your electric motorcycles, battery charge capacities, and current lease contracts.
              </p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
                <h4 className="text-xs font-bold text-white">Key Inventory Actions</h4>
                <div className="grid gap-4 md:grid-cols-2 text-xs text-zinc-500 leading-relaxed">
                  <div>
                    <strong className="text-white">Adding a Bike:</strong>
                    <p className="mt-1">Click the &quot;+ Add Bike&quot; button, enter the chassis number, Rwanda license plate number, battery configuration (72V/60Ah), and select the manufacturing year.</p>
                  </div>
                  <div>
                    <strong className="text-white">Setting Lease Progress:</strong>
                    <p className="mt-1">Click on a vehicle row to set lease duration, maturity date, and daily payment rates for lease-to-own riders.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Device Binding */}
            <div id="guide-devices" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-purple-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 5: Telemetry &amp; Device Binding</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Bind hardware IoT GPS tracking units to physical motorcycles inside the system to initiate live data telemetry feeds.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
                  <h4 className="text-xs font-bold text-white">Binding Steps</h4>
                  <ol className="list-decimal list-inside mt-3 text-xs text-zinc-500 space-y-2 leading-relaxed">
                    <li>Navigate to the **Devices** control panel.</li>
                    <li>Click **&quot;Bind New Unit&quot;**.</li>
                    <li>Input the 15-digit **SinoTrack Device UID**.</li>
                    <li>Select the target **Bike ID** plate from the dropdown menu.</li>
                    <li>Input the SIM card cellular phone number and choose carrier (**MTN** or **Airtel**).</li>
                  </ol>
                </div>
                <div className="rounded-lg border border-yellow-500/10 bg-yellow-500/[0.01] p-5 text-xs text-zinc-500 leading-relaxed">
                  <strong className="text-yellow-500 block mb-2">Hardware Setup Check:</strong>
                  <p className="mb-2">Before leaving the workshop, make sure the installer sends the SMS setup strings to the SIM card. The yellow signal lights on the tracker must be solid before you click &quot;Test Stream&quot;.</p>
                  <p>Refer to the <a href="#sinotrack" className="text-blue-400 hover:underline">SinoTrack SMS Programming guide</a> below for commands.</p>
                </div>
              </div>
            </div>

            {/* 6. Rider Directory */}
            <div id="guide-riders" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-emerald-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 6: Rider Profiles &amp; Safety Ratings</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Keep profiles for all electric motorcycle lease-to-own riders, evaluate speed violations, and review safety scores.
              </p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 space-y-3">
                <h4 className="text-xs font-bold text-white">Onboarding &amp; Safety Tracking</h4>
                <ul className="list-disc list-inside text-xs text-zinc-500 space-y-2 leading-relaxed">
                  <li><strong>National ID Verification:</strong> Upload rider name, phone, and Rwanda National ID details to verify driver background.</li>
                  <li><strong>Driver Safety Score:</strong> System maps speed limit exceedance inside Kigali slow-zones and registers a safety score from 0-100.</li>
                  <li><strong>Active Assignment:</strong> Match riders to dedicated bikes. A rider can only hold one active bike assignment.</li>
                </ul>
              </div>
            </div>

            {/* 7. Incident Command */}
            <div id="guide-incidents" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <AlertOctagon size={20} className="text-rose-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 7: Incident Command &amp; Evidence Packs</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Manage crash alerts, emergency rider SOS signals, and export cryptographic telemetry data logs to validate claims.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
                  <h4 className="text-xs font-bold text-white">Managing Crash Alerts</h4>
                  <ul className="list-disc list-inside mt-3 text-xs text-zinc-500 space-y-2 leading-relaxed">
                    <li><strong>Real-time Alert:</strong> An impact forces accelerometer values above 2.5g, triggering a notification panel warning.</li>
                    <li><strong>Location Mapping:</strong> View coordinates, speed logs, and historical pathing just before the impact event.</li>
                    <li><strong>Exporting PDF Evidence:</strong> Generate official evidence files including telemetry graphs to verify accident claims.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 text-xs text-zinc-500 leading-relaxed">
                  <strong className="text-white block mb-2">Evidence Retention Rule:</strong>
                  <p className="mb-2">⚠️ G-force telemetry datasets are stored on active databases for **90 days**. Make sure to compile and download accident PDF evidence packs within this window.</p>
                  <p>Insurers can access this folder directly under their scoped account credentials.</p>
                </div>
              </div>
            </div>

            {/* 8. Geofencing */}
            <div id="guide-geofencing" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Layers size={20} className="text-blue-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 8: Geofencing Zones Setup</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Configure geographic boundaries on the map to monitor zone compliance, restrict bike travel to specified routes, and limit speeds.
              </p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
                <h4 className="text-xs font-bold text-white">How to Draw and Configure Geofences</h4>
                <div className="grid gap-4 md:grid-cols-2 text-xs text-zinc-500 leading-relaxed">
                  <div>
                    <strong className="text-white">Drawing on Canvas:</strong>
                    <p className="mt-1">Click the Drawing Polygon tool. Click on the map to create bounding anchors around your target area (e.g. Kigali Central or Gikondo district). Double-click to close the polygon.</p>
                  </div>
                  <div>
                    <strong className="text-white">Setting Zone Rules:</strong>
                    <p className="mt-1">Define maximum speeds inside the boundary. Choose &quot;Notify Operators&quot; or &quot;Automatic Cutoff&quot; if a vehicle crosses geofence boundaries during restricted night hours.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 9. Financials & Leasing */}
            <div id="guide-financials" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <DollarSign size={20} className="text-emerald-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 9: Financials &amp; Leasing Ledger</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Track payments, arrears, and lease maturity for electric motorcycles inside the system.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
                  <h4 className="text-xs font-bold text-white">Key Ledger Actions</h4>
                  <ul className="list-disc list-inside mt-3 text-xs text-zinc-500 space-y-2 leading-relaxed">
                    <li><strong>Record Collection:</strong> Input manual lease receipts (payments via Cash or Bank transfer).</li>
                    <li><strong>Reconcile MTN MoMo:</strong> Match transactional reference IDs from MTN Mobile Money to clear pending arrears.</li>
                    <li><strong>Export Ledger:</strong> Generate clean Excel/CSV lists of accounts for tax audits and internal ledgers.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 text-xs text-zinc-500 leading-relaxed">
                  <strong className="text-white block mb-2">Lease Arrears Policies:</strong>
                  <p className="mb-2">Riders who miss more than 3 consecutive lease payments are automatically flagged in red in the Rider Directory.</p>
                  <p>Operators can configure automated payment reminder SMS alerts in settings.</p>
                </div>
              </div>
            </div>

            {/* 10. Settings & Webhooks */}
            <div id="guide-settings" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-zinc-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 10: Settings, Members &amp; Webhooks</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Manage team invitations, security configurations, API integration keys, and event listeners.
              </p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
                <h4 className="text-xs font-bold text-white">Team Profiles &amp; Webhook Triggers</h4>
                <div className="grid gap-4 md:grid-cols-2 text-xs text-zinc-500 leading-relaxed">
                  <div>
                    <strong className="text-white">Inviting Team Members:</strong>
                    <p className="mt-1">Add emails to invite staff. Choose roles: `ADMIN` (full access), `OPERATOR` (dispatch lock commands, log payments), or `INSURER` (read-only investigations).</p>
                  </div>
                  <div>
                    <strong className="text-white">Configuring Webhooks:</strong>
                    <p className="mt-1">Link internal REST endpoints to listen for system-wide triggers (e.g. crash events or unauthorized boundary exit alerts) with secure JSON payloads.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 11. Insurer Portal */}
            <div id="guide-insurer" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <UserCheck size={20} className="text-blue-400" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 11: Insurer Portal Controls</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                Specifically scoped, read-only interface for insurance underwriting partners. Verify covered vehicles and review crash telemetry reports.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
                  <h4 className="text-xs font-bold text-white">Allowed Insurer Tasks</h4>
                  <ul className="list-disc list-inside mt-3 text-xs text-zinc-500 space-y-2 leading-relaxed">
                    <li><strong>Active Policy Search:</strong> Verify the active coverage dates for electric bikes registered in partner fleets.</li>
                    <li><strong>Telemetry Crash Replay:</strong> Review velocity logs, g-force charts, and locations of logged impact events.</li>
                    <li><strong>Evidence Approvals:</strong> Process insurance claims with empirical telemetry data logs.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-blue-500/10 bg-blue-500/[0.01] p-5 text-xs text-zinc-500 leading-relaxed">
                  <strong className="text-blue-400 block mb-2">Access Restrictions:</strong>
                  <p className="mb-2">🔒 Insurer credentials do **not** have access to the Live Map tracking view, road context layers, driver name lookups, or remote immobilization commands.</p>
                  <p>Insurers receive an empty array `[]` (0 features) on general roads endpoints for privacy compliance.</p>
                </div>
              </div>
            </div>

            {/* 12. HQ Control Desk */}
            <div id="guide-hq" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-accent" />
                <h2 className="text-xl font-bold text-white">SaaS Guide 12: HQ Control Desk (Admin Only)</h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                The global backend control dashboard accessible only by verified eMoto system operators and administrators.
              </p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
                <h4 className="text-xs font-bold text-white">Administrative Capabilities</h4>
                <div className="grid gap-4 md:grid-cols-2 text-xs text-zinc-500 leading-relaxed">
                  <div>
                    <strong className="text-white">Global Fleet Verification:</strong>
                    <p className="mt-1">Review pending registrations, verify business tax IDs, activate billing schedules, and unlock new fleet administrator accounts.</p>
                  </div>
                  <div>
                    <strong className="text-white">POI &amp; Road Context Management:</strong>
                    <p className="mt-1">Upload global KML/GeoJSON files containing schools, traffic lights, and marketplace boundaries to keep the road context coordinates database up-to-date.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Technical Reference Section --- */}

            {/* Guide Section 5 (Now 17): SinoTrack SMS Setup */}
            <div id="sinotrack" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Terminal size={20} className="text-blue-400" />
                <h2 className="text-xl font-bold text-white">17. SinoTrack ST-901 SMS Programming</h2>
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

            {/* Guide Section 6 (Now 18): MQTT Ingest */}
            <div id="mqtt" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <Cpu size={20} className="text-purple-400" />
                <h2 className="text-xl font-bold text-white">18. MQTT Telemetry Broker Configuration</h2>
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

            {/* Guide Section 7 (Now 19): REST API */}
            <div id="rest-api" className="space-y-6 scroll-mt-24 border-t border-white/[0.06] pt-10">
              <div className="flex items-center gap-3">
                <FileCode size={20} className="text-accent" />
                <h2 className="text-xl font-bold text-white">19. REST Developer API Reference</h2>
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
