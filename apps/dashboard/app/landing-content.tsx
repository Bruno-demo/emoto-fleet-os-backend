import Link from 'next/link';
import { cookies } from 'next/headers';
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
export default async function LandingContent() {
  const cookieStore = await cookies();
  const authCookieName = process.env.AUTH_COOKIE_NAME ?? 'emoto_access_token';
  const hasSession = Boolean(cookieStore.get(authCookieName)?.value);

  return (
    <div className="min-h-screen text-ink">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-accent/20 border border-line text-accent shadow-[var(--shadow-soft)] hover:scale-105 hover:bg-accent/30 transition-all">
            <Bike size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-muted">E-Moto Safety</p>
            <p className="text-lg font-semibold">Fleet OS</p>
          </div>
        </div>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-soft md:flex">
          <a href="#features" className="transition hover:text-ink">
            Features
          </a>
          <a href="#dashboard" className="transition hover:text-ink">
            Dashboard
          </a>
          <a href="#how-it-works" className="transition hover:text-ink">
            How it works
          </a>
          <a href="#pricing" className="transition hover:text-ink">
            Pricing
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {hasSession ? (
            <Link
              href="/live"
              className="rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)] shadow-[var(--shadow-soft)]"
            >
              Account
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-[var(--radius-control)] border border-line px-4 py-2 text-sm font-semibold text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/create-account"
                className="rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)] shadow-[var(--shadow-soft)]"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-6 py-20 lg:py-32 flex flex-col items-center text-center overflow-hidden">
        {/* Intense background flares */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/20 blur-[120px] rounded-[100%] pointer-events-none" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[400px] bg-success-ink/10 blur-[100px] rounded-[100%] pointer-events-none" />
        
        <span className="relative z-10 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent backdrop-blur-md mb-8 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <Sparkles size={14} />
          Smart mobility command center
        </span>
        
        <h1 className="relative z-10 text-[clamp(2.5rem,5vw,5rem)] font-bold leading-[1.05] tracking-tight max-w-4xl text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50">
          Real-time safety and performance for electric motorcycle fleets.
        </h1>
        
        <p className="relative z-10 mt-6 max-w-2xl text-lg leading-8 text-ink-soft">
          Track live riders, coordinate response, and automate compliance reporting. Built for operations teams across Africa with secure telemetry, incident workflows, and rider scoring.
        </p>

        <div className="relative z-10 mt-10 flex flex-wrap justify-center gap-4">
          {hasSession ? (
            <Link
              href="/live"
              className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-accent px-8 py-4 text-sm font-bold text-[color:var(--accent-foreground)] shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-105 transition-transform"
            >
              Open Account
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-accent px-8 py-4 text-sm font-bold text-[color:var(--accent-foreground)] shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-105 transition-transform"
              >
                Enter command center
              </Link>
              <Link
                href="/create-account"
                className="inline-flex glass-panel items-center justify-center rounded-[var(--radius-control)] border border-line px-8 py-4 text-sm font-semibold text-ink hover:bg-surface-hover transition-colors"
              >
                Request fleet access
              </Link>
            </>
          )}
        </div>

        {/* Floating Dashboard Visual / Metrics overlay */}
        <div className="relative w-full max-w-5xl mt-24 glass-panel rounded-[32px] p-2 border border-line/50 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] animate-[pulse_4s_ease-in-out_infinite]">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 rounded-[32px] pointer-events-none" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-8 bg-black/40 rounded-[28px] backdrop-blur-xl border border-white/5 relative z-20">
              {metrics.map((metric) => (
                <div key={metric.label} className="text-left space-y-2">
                  <p className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-white">{metric.value}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">{metric.label}</p>
                </div>
              ))}
          </div>
        </div>
      </main>

      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Capabilities grid</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white max-w-3xl">Everything dispatch needs to respond faster.</h2>
          <p className="max-w-2xl text-base leading-7 text-ink-muted mt-2">
            Manage riders, devices, incidents, and partner reporting without switching tools. Built for
            real-time operations and low-latency decision making.
          </p>
        </div>
        
        {/* Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 lg:gap-6 auto-rows-[280px]">
          {featureRows.map((feature, idx) => (
            <article 
              key={feature.title} 
              className={`glass-panel group relative overflow-hidden rounded-[32px] border border-white/10 p-8 transition-all hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] ${idx === 0 || idx === 3 ? 'md:col-span-2' : 'md:col-span-1'}`}
            >
              {/* Subtle hover gradient flare */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              
              <div className="relative z-10 flex flex-col h-full justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/5 border border-white/10 text-accent backdrop-blur-md shadow-inner">
                  {feature.icon}
                </span>
                <div>
                  <h3 className="mt-6 text-xl font-bold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft max-w-sm">{feature.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="dashboard" className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Live map</p>
                <h3 className="mt-2 text-xl font-semibold">Street-level visibility</h3>
              </div>
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                Kigali demo
              </span>
            </div>
            <div
              className="mt-5 h-[300px] rounded-[var(--radius-panel)] border border-line bg-surface-muted"
              style={{
                backgroundImage:
                  'linear-gradient(120deg, rgba(15,23,42,0.85), rgba(15,23,42,0.1)), url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="flex h-full flex-col justify-between p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                  <MapPinned size={14} />
                  Map intelligence
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DashboardStatCard label="Active zones" value="12" hint="geofenced" accent="success" />
                  <DashboardStatCard label="Alerts" value="6" hint="last hour" accent="warning" />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                    {item.icon}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-6 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">How it works</p>
          <h2 className="mt-3 text-2xl font-semibold">Launch the system in three steps.</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-[var(--radius-panel)] border border-line bg-surface-muted p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent text-[color:var(--accent-foreground)] text-sm font-semibold">
                    {index + 1}
                  </span>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-ink-soft">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] group">
          <div className="glass-panel rounded-[var(--radius-panel)] px-6 py-6 hover:scale-[1.01] transition-transform">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Benefits</p>
            <h2 className="mt-3 text-2xl font-semibold">Built for safety, compliance, and growth.</h2>
            <p className="mt-3 text-sm text-ink-soft">
              Coordinate dispatch teams, guide riders, and meet compliance requirements with clear
              workflows and reliable data.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-[var(--radius-panel)] border border-line/50 bg-black/20 p-4 hover:-translate-y-1 transition-transform">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                    {benefit.icon}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-xs text-ink-soft">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-line bg-surface-muted px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Operations proof</p>
            <h3 className="mt-3 text-xl font-semibold">Trusted by mobility operators.</h3>
            <div className="mt-6 space-y-4">
              {testimonials.map((testimonial) => (
                <figure key={testimonial.name} className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3">
                  <p className="text-sm text-ink-soft">"{testimonial.quote}"</p>
                  <figcaption className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                    {testimonial.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-24 relative">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent backdrop-blur-md">
            Pricing Maps
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white max-w-2xl">Choose a plan that scales with your fleet.</h2>
          <p className="text-base text-ink-muted">Flexible pricing for every stage of growth.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3 relative z-10 items-center">
          {pricingPlans.map((plan) => (
            <div
              key={plan.title}
              className={`glass-panel relative rounded-[32px] p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex flex-col ${
                plan.featured ? 'border-accent bg-accent/10 lg:scale-[1.08] shadow-[0_0_30px_rgba(59,130,246,0.3)] z-10 py-12' : 'border-white/10 bg-black/20'
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-[color:var(--accent-foreground)] px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                  Most Popular
                </div>
              )}
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">{plan.title}</p>
              <h3 className="mt-3 text-4xl font-bold text-white mb-4">{plan.price}</h3>
              <p className="text-sm text-ink-soft leading-relaxed min-h-[60px]">{plan.description}</p>
              
              <div className="my-8 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              
              <ul className="space-y-4 text-sm text-ink-soft mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-accent shrink-0">
                      <BadgeCheck size={12} />
                    </span>
                    <span className="text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/create-account"
                className={`mt-auto inline-flex w-full items-center justify-center rounded-[var(--radius-control)] px-4 py-4 text-sm font-bold transition-transform hover:scale-105 ${
                  plan.featured
                    ? 'bg-accent text-[color:var(--accent-foreground)] shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    : 'glass-panel border border-white/20 text-white hover:bg-white/5'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-8 py-8">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Ready to deploy</p>
              <h2 className="mt-3 text-2xl font-semibold">Turn on safer mobility for every rider.</h2>
              <p className="mt-2 text-sm text-ink-soft">
                Launch the command center in minutes, then expand into rider scoring and partner reporting as
                your operations grow.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              {hasSession ? (
                <Link
                  href="/live"
                  className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-accent px-5 py-3 text-sm font-semibold text-[color:var(--accent-foreground)]"
                >
                  Account
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-accent px-5 py-3 text-sm font-semibold text-[color:var(--accent-foreground)]"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/create-account"
                    className="inline-flex items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-sm text-ink-muted">
        <div className="flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">E-Moto Safety</p>
            <p className="text-base font-semibold text-ink">Smart Mobility Starts Here</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-2 text-ink-muted">
              <Users2 size={14} /> Rider app
            </span>
            <span className="inline-flex items-center gap-2 text-ink-muted">
              <Cpu size={14} /> Partner API
            </span>
            <span className="inline-flex items-center gap-2 text-ink-muted">
              <Activity size={14} /> Compliance ready
            </span>
          </div>
          <p className="text-xs text-ink-muted">(C) 2026 E-Moto Safety & Fleet OS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// Renders a compact metric tile for hero stats.
function HeroStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{label}</p>
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
  accent: 'success' | 'danger' | 'warning' | 'info';
}) {
  const accentClasses: Record<typeof accent, string> = {
    success: 'text-success-ink bg-success-soft',
    danger: 'text-danger-ink bg-danger-soft',
    warning: 'text-warning-ink bg-warning-soft',
    info: 'text-ink bg-surface-muted',
  };

  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{label}</p>
        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${accentClasses[accent]}`}>
          {hint}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
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
  badgeTone: 'warning' | 'danger';
}) {
  const badgeClasses: Record<typeof badgeTone, string> = {
    warning: 'bg-warning-soft text-warning-ink',
    danger: 'bg-danger-soft text-danger-ink',
  };

  return (
    <div className="mt-4 rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses[badgeTone]}`}>
          {badge}
        </span>
      </div>
    </div>
  );
}
