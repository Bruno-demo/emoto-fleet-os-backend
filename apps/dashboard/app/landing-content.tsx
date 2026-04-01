import Link from 'next/link';
import {
  Activity,
  AlarmClock,
  BadgeCheck,
  BatteryCharging,
  Bike,
  Cpu,
  Gauge,
  Globe2,
  Layers,
  LocateFixed,
  MapPinned,
  Radar,
  ShieldCheck,
  Signal,
  Siren,
  Sparkles,
  Users2,
} from 'lucide-react';

const metrics = [
  { label: 'Active bikes', value: '1,284' },
  { label: 'Incidents resolved', value: '96%' },
  { label: 'Avg response time', value: '2.4m' },
  { label: 'Uptime', value: '99.9%' },
];

const highlights = [
  {
    title: 'Live command center',
    description: 'See every rider, device, and incident in one operational view with streaming updates.',
    icon: <Radar size={18} />,
  },
  {
    title: 'Safety automation',
    description: 'Detect risky behavior instantly and turn it into workflows for dispatch teams.',
    icon: <Siren size={18} />,
  },
  {
    title: 'Trusted data',
    description: 'Signed telemetry, audit logs, and partner access keep compliance teams aligned.',
    icon: <ShieldCheck size={18} />,
  },
];

const featureRows = [
  {
    title: 'Fleet visibility',
    description: 'Live bikes, riders, and trips updated every second.',
    icon: <LocateFixed size={16} />,
  },
  {
    title: 'Incident workflows',
    description: 'Crash and SOS response with escalation controls.',
    icon: <AlarmClock size={16} />,
  },
  {
    title: 'Command & control',
    description: 'Secure lock, unlock, and device commands in real time.',
    icon: <Signal size={16} />,
  },
  {
    title: 'Trip intelligence',
    description: 'Trip scoring and coaching for safer riders.',
    icon: <Gauge size={16} />,
  },
  {
    title: 'Battery insight',
    description: 'Battery health, charge, and station visibility.',
    icon: <BatteryCharging size={16} />,
  },
  {
    title: 'Partner access',
    description: 'Share limited datasets with insurers and partners.',
    icon: <Globe2 size={16} />,
  },
];

const workflowSteps = [
  {
    title: 'Connect devices',
    description: 'Provision bikes, upload IMEI keys, and sync live telemetry.',
  },
  {
    title: 'Monitor operations',
    description: 'Dispatch sees live riders, alerts, and command states in one view.',
  },
  {
    title: 'Drive safer outcomes',
    description: 'Score riders, resolve incidents, and automate compliance reporting.',
  },
];

const benefits = [
  {
    title: 'Faster response',
    description: 'Reduce incident response times with clear dispatch tooling.',
    icon: <AlarmClock size={18} />,
  },
  {
    title: 'Safer riders',
    description: 'Detect harsh events and coach riders before problems escalate.',
    icon: <BadgeCheck size={18} />,
  },
  {
    title: 'Lower losses',
    description: 'Track theft, disable bikes, and alert partners instantly.',
    icon: <ShieldCheck size={18} />,
  },
  {
    title: 'Decision ready',
    description: 'Dashboards show KPIs for leadership and compliance.',
    icon: <Layers size={18} />,
  },
];

const testimonials = [
  {
    quote:
      'We cut our incident response time by over 60 percent while improving rider safety scores in just two months.',
    name: 'Dispatch Lead, Kigali Logistics',
  },
  {
    quote:
      'The command center gives us confidence when deploying hundreds of bikes across the city.',
    name: 'Fleet Ops Director, Urban Mobility',
  },
  {
    quote:
      'Real-time telemetry and secure audit trails are essential for our insurer partnerships.',
    name: 'Risk Manager, Regional Insurer',
  },
];

const pricingPlans = [
  {
    title: 'Safety Core',
    price: '$6 / bike',
    description: 'Live tracking, incident response, and rider scoring.',
    features: ['Live map + alerts', 'Incident workflows', 'Rider scores'],
  },
  {
    title: 'Operations Plus',
    price: '$9 / bike',
    description: 'Commands, trip analytics, and compliance dashboards.',
    features: ['Command controls', 'Trip analytics', 'Compliance reports'],
    featured: true,
  },
  {
    title: 'Enterprise',
    price: 'Custom',
    description: 'Partner API, dedicated support, and SLA coverage.',
    features: ['Partner API', 'Dedicated support', 'Enterprise SLA'],
  },
];

// Renders the dashboard marketing landing page based on the supplied Figma layout.
export default function LandingContent() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_42%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(14,116,144,0.16),transparent_45%)]" />
        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/10 text-white shadow-[0_16px_32px_rgba(15,23,42,0.55)]">
              <Bike size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">E-Moto Safety</p>
              <p className="text-lg font-semibold">Fleet OS</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-white/70 md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#dashboard" className="transition hover:text-white">
              Dashboard
            </a>
            <a href="#how-it-works" className="transition hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Pricing
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="rounded-[12px] border border-white/20 px-4 py-2 text-sm font-semibold text-white/90"
            >
              Sign in
            </Link>
            <Link
              href="/create-account"
              className="rounded-[12px] bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_16px_40px_rgba(16,185,129,0.35)]"
            >
              Create account
            </Link>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-20">
          <section className="grid gap-10 pb-16 pt-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                <Sparkles size={14} />
                Smart mobility command center
              </span>
              <h1 className="text-[clamp(2.4rem,2.1rem+1.8vw,3.7rem)] font-semibold leading-tight">
                Real-time safety and performance for electric motorcycle fleets.
              </h1>
              <p className="max-w-xl text-base leading-7 text-white/70">
                Track live riders, coordinate response, and automate compliance reporting. Built for
                operations teams across Africa with secure telemetry, incident workflows, and rider
                scoring in one dashboard.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-[14px] bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_20px_44px_rgba(16,185,129,0.35)]"
                >
                  Enter command center
                </Link>
                <Link
                  href="/create-account"
                  className="inline-flex items-center justify-center rounded-[14px] border border-white/20 px-5 py-3 text-sm font-semibold text-white"
                >
                  Request fleet access
                </Link>
              </div>

              <div className="grid gap-4 pt-4 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <HeroStatCard key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                <span className="rounded-full border border-white/15 px-3 py-1">Dashboard</span>
                <span className="rounded-full border border-white/15 px-3 py-1">Rider app</span>
                <span className="rounded-full border border-white/15 px-3 py-1">Partner API</span>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/5 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.55)]">
              <div className="rounded-[22px] border border-white/10 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  <span>Live command preview</span>
                  <span className="rounded-full border border-white/20 px-3 py-1">Connected</span>
                </div>

                <div className="mt-5 grid gap-4">
                  <DashboardStatCard label="Live bikes" value="128" hint="online now" accent="emerald" />
                  <DashboardStatCard label="Open incidents" value="4" hint="triage ready" accent="rose" />
                  <DashboardStatCard label="Avg score" value="86.4" hint="weekly" accent="amber" />
                  <DashboardStatCard label="Commands sent" value="31" hint="today" accent="sky" />
                </div>

                <div className="mt-6 rounded-[18px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                    <span>Alerts</span>
                    <span className="rounded-full border border-white/20 px-3 py-1">Realtime</span>
                  </div>
                  <DashboardListCard
                    title="Overspeed"
                    subtitle="North-001"
                    badge="Medium"
                    badgeTone="amber"
                  />
                  <DashboardListCard
                    title="Crash detected"
                    subtitle="KGL-090"
                    badge="Critical"
                    badgeTone="rose"
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Features</p>
          <h2 className="text-2xl font-semibold">Everything dispatch needs to respond faster.</h2>
          <p className="max-w-2xl text-sm leading-6 text-white/65">
            Manage riders, devices, incidents, and partner reporting without switching tools. Built for
            real-time operations and low-latency decision making.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureRows.map((feature) => (
            <article key={feature.title} className="rounded-[20px] border border-white/10 bg-white/5 p-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-400/10 text-emerald-300">
                {feature.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-white/60">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="dashboard" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Live map</p>
                <h3 className="mt-2 text-xl font-semibold">Street-level visibility</h3>
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Kigali demo
              </span>
            </div>
            <div
              className="mt-5 h-[320px] rounded-[22px] border border-white/10 bg-slate-900/60"
              style={{
                backgroundImage:
                  'linear-gradient(120deg, rgba(15,23,42,0.9), rgba(15,23,42,0.1)), url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="flex h-full flex-col justify-between p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  <MapPinned size={14} />
                  Map intelligence
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DashboardStatCard label="Active zones" value="12" hint="geofenced" accent="emerald" />
                  <DashboardStatCard label="Alerts" value="6" hint="last hour" accent="amber" />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-400/10 text-emerald-300">
                    {item.icon}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-white/65">{item.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">How it works</p>
          <h2 className="mt-3 text-2xl font-semibold">Launch the system in three steps.</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-[22px] border border-white/10 bg-slate-900/60 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-400 text-slate-900 text-sm font-semibold">
                    {index + 1}
                  </span>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-white/65">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Benefits</p>
            <h2 className="mt-3 text-2xl font-semibold">Built for safety, compliance, and growth.</h2>
            <p className="mt-3 text-sm text-white/65">
              Coordinate dispatch teams, guide riders, and meet compliance requirements with clear
              workflows and reliable data.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-[20px] border border-white/10 bg-slate-900/60 p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-400/10 text-emerald-300">
                    {benefit.icon}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-xs text-white/60">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Operations proof</p>
            <h3 className="mt-3 text-xl font-semibold">Trusted by mobility operators.</h3>
            <div className="mt-6 space-y-4">
              {testimonials.map((testimonial) => (
                <figure key={testimonial.name} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/70">"{testimonial.quote}"</p>
                  <figcaption className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                    {testimonial.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Pricing</p>
          <h2 className="text-2xl font-semibold">Choose a plan that scales with your fleet.</h2>
          <p className="text-sm text-white/65">Flexible pricing for every stage of growth.</p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.title}
              className={`rounded-[26px] border p-6 ${
                plan.featured
                  ? 'border-emerald-400/60 bg-emerald-400/10 shadow-[0_24px_60px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">{plan.title}</p>
              <h3 className="mt-3 text-2xl font-semibold">{plan.price}</h3>
              <p className="mt-3 text-sm text-white/65">{plan.description}</p>
              <ul className="mt-5 space-y-3 text-sm text-white/70">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/create-account"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-[14px] px-4 py-2 text-sm font-semibold ${
                  plan.featured
                    ? 'bg-emerald-400 text-slate-900'
                    : 'border border-white/20 text-white'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-[28px] border border-white/10 bg-gradient-to-r from-emerald-400/20 via-slate-900/50 to-slate-900/80 px-8 py-8">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">Ready to deploy</p>
              <h2 className="mt-3 text-2xl font-semibold">Turn on safer mobility for every rider.</h2>
              <p className="mt-2 text-sm text-white/70">
                Launch the command center in minutes, then expand into rider scoring and partner reporting as
                your operations grow.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-[14px] bg-white px-5 py-3 text-sm font-semibold text-slate-900"
              >
                Sign in
              </Link>
              <Link
                href="/create-account"
                className="inline-flex items-center justify-center rounded-[14px] border border-white/25 px-5 py-3 text-sm font-semibold text-white"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-sm text-white/60">
        <div className="flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">E-Moto Safety</p>
            <p className="text-base font-semibold text-white">Smart Mobility Starts Here</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-2 text-white/60">
              <Users2 size={14} /> Rider app
            </span>
            <span className="inline-flex items-center gap-2 text-white/60">
              <Cpu size={14} /> Partner API
            </span>
            <span className="inline-flex items-center gap-2 text-white/60">
              <Activity size={14} /> Compliance ready
            </span>
          </div>
          <p className="text-xs text-white/40">(C) 2026 E-Moto Safety & Fleet OS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// Renders a compact metric tile for hero stats.
function HeroStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">{label}</p>
    </div>
  );
}

// Renders a compact metric card used in the command preview panel.
function DashboardStatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: 'emerald' | 'rose' | 'amber' | 'sky';
}) {
  const accentClasses: Record<typeof accent, string> = {
    emerald: 'text-emerald-300 bg-emerald-400/10',
    rose: 'text-rose-300 bg-rose-500/10',
    amber: 'text-amber-200 bg-amber-400/10',
    sky: 'text-sky-300 bg-sky-500/10',
  };

  return (
    <div className="rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{label}</p>
        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${accentClasses[accent]}`}>
          {hint}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

// Renders a list card used for the preview alerts section.
function DashboardListCard({
  title,
  subtitle,
  badge,
  badgeTone,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: 'amber' | 'rose';
}) {
  const badgeClasses: Record<typeof badgeTone, string> = {
    amber: 'bg-amber-400/15 text-amber-200',
    rose: 'bg-rose-500/15 text-rose-200',
  };

  return (
    <div className="mt-4 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/60">{subtitle}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses[badgeTone]}`}>
          {badge}
        </span>
      </div>
    </div>
  );
}
