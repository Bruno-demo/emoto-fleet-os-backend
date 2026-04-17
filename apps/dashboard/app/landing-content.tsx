import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  Activity,
  AlarmClock,
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Bike,
  CalendarCheck,
  ChevronRight,
  Cpu,
  Gauge,
  Globe2,
  Layers,
  LocateFixed,
  Radar,
  ShieldCheck,
  Signal,
  Siren,
  Sparkles,
  Users2,
  Zap,
} from 'lucide-react';

const metrics = [
  { label: 'Active bikes', value: '1,284', icon: <Bike size={16} /> },
  { label: 'Incidents resolved', value: '96%', icon: <ShieldCheck size={16} /> },
  { label: 'Avg response', value: '2.4 min', icon: <Zap size={16} /> },
  { label: 'Platform uptime', value: '99.9%', icon: <Activity size={16} /> },
];

const highlights = [
  { icon: <Radar size={18} />, title: 'Live command center', desc: 'See every rider, device, and incident in one streaming operational view.' },
  { icon: <Siren size={18} />, title: 'Safety automation', desc: 'Detect risky behavior instantly and turn it into dispatch workflows.' },
  { icon: <ShieldCheck size={18} />, title: 'Trusted data', desc: 'Signed telemetry, audit logs, and partner access for compliance.' },
];

const featureRows = [
  {
    title: 'Fleet visibility',
    description: 'Live bike and rider positions updated every second with geofence alerts.',
    icon: <LocateFixed size={20} />,
    span: 'md:col-span-2',
  },
  {
    title: 'Incident workflows',
    description: 'Crash and SOS dispatch with escalation, evidence, and timeline.',
    icon: <AlarmClock size={20} />,
    span: '',
  },
  {
    title: 'Command & control',
    description: 'Secure lock, unlock, and OTA commands with audit logging.',
    icon: <Signal size={20} />,
    span: '',
  },
  {
    title: 'Trip intelligence',
    description: 'Trip scoring, rider coaching, and fleet-wide performance analytics.',
    icon: <Gauge size={20} />,
    span: 'md:col-span-2',
  },
  {
    title: 'Battery insight',
    description: 'Battery health, charge cycles, and swap station proximity.',
    icon: <BatteryCharging size={20} />,
    span: '',
  },
  {
    title: 'Partner access',
    description: 'Scoped API tokens for insurers, regulators, and partners.',
    icon: <Globe2 size={20} />,
    span: '',
  },
];

const workflowSteps = [
  {
    num: '01',
    title: 'Connect devices',
    description: 'Provision bikes, upload IMEI keys, and sync live telemetry streams in minutes.',
  },
  {
    num: '02',
    title: 'Monitor operations',
    description: 'Dispatch teams see live riders, alerts, and command states in one unified view.',
  },
  {
    num: '03',
    title: 'Drive safer outcomes',
    description: 'Score riders, resolve incidents, and automate compliance reporting at scale.',
  },
];

const benefits = [
  {
    title: 'Faster response',
    description: 'Cut incident response times with clear dispatch tooling and guided workflows.',
    icon: <AlarmClock size={18} />,
  },
  {
    title: 'Safer riders',
    description: 'Detect harsh events and coach riders through scoring before problems escalate.',
    icon: <BadgeCheck size={18} />,
  },
  {
    title: 'Lower losses',
    description: 'Track theft, disable bikes remotely, and alert partners instantly.',
    icon: <ShieldCheck size={18} />,
  },
  {
    title: 'Decision ready',
    description: 'KPI dashboards for leadership, compliance, and partner reporting.',
    icon: <Layers size={18} />,
  },
];

const testimonials = [
  {
    quote: 'We cut our incident response time by over 60% while improving rider safety scores in just two months.',
    name: 'Dispatch Lead',
    org: 'Kigali Logistics',
  },
  {
    quote: 'The command center gives us confidence when deploying hundreds of bikes across the city.',
    name: 'Fleet Ops Director',
    org: 'Urban Mobility',
  },
  {
    quote: 'Real-time telemetry and secure audit trails are essential for our insurer partnerships.',
    name: 'Risk Manager',
    org: 'Regional Insurer',
  },
];

const pricingPlans = [
  {
    slug: 'safety-core',
    title: 'Safety Core',
    price: '$6',
    period: '/ bike / mo',
    description: 'Live tracking, incident response, and rider scoring for growing fleets.',
    features: ['Live map + alerts', 'Incident workflows', 'Rider scores', 'Email support'],
  },
  {
    slug: 'operations-plus',
    title: 'Operations Plus',
    price: '$9',
    period: '/ bike / mo',
    description: 'Full command center with trip analytics and compliance dashboards.',
    features: ['Everything in Core', 'Command controls', 'Trip analytics', 'Compliance reports', 'Priority support'],
    featured: true,
  },
  {
    slug: 'enterprise',
    title: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Dedicated infrastructure, partner API, and SLA coverage.',
    features: ['Everything in Plus', 'Partner API', 'Dedicated support', 'Enterprise SLA', 'Custom integrations'],
  },
];

const trustedBy = [
  'Kigali Fleet Co.',
  'SafeRide Africa',
  'MotoGuard',
  'Urban Dispatch',
  'GreenWheel',
];

// Renders the dashboard landing page with professional SaaS layout.
export default async function LandingContent() {
  const cookieStore = await cookies();
  const authCookieName = process.env.AUTH_COOKIE_NAME ?? 'emoto_access_token';
  const hasSession = Boolean(cookieStore.get(authCookieName)?.value);

  return (
    <div className="min-h-screen text-ink overflow-x-hidden">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-line/50 bg-background/80">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 border border-accent/30 text-accent transition group-hover:bg-accent/30 group-hover:scale-105">
              <Bike size={18} />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted">eMoto</p>
              <p className="text-sm font-bold">Fleet OS</p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-[13px] font-semibold text-ink-soft md:flex">
            <a href="#features" className="transition hover:text-ink">Features</a>
            <a href="#how-it-works" className="transition hover:text-ink">How it works</a>
            <a href="#pricing" className="transition hover:text-ink">Pricing</a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {hasSession ? (
              <Link href="/live" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] hover:scale-105 transition-transform">
                Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link href="/create-account?flow=demo" className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/20 transition">
                  <CalendarCheck size={14} /> Book demo
                </Link>
                <Link href="/login" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-hover transition">Sign in</Link>
                <Link href="/create-account" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] hover:scale-105 transition-transform">
                  Get started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-24 pb-32 lg:pt-36 lg:pb-40 flex flex-col items-center text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-accent/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-success-ink/8 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 -left-20 w-[300px] h-[300px] bg-purple-ink/8 blur-[100px] rounded-full pointer-events-none" />

        <span className="relative z-10 mb-8 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.3)]">
          <Sparkles size={13} />
          Smart mobility command center
        </span>

        <h1 className="relative z-10 text-[clamp(2.5rem,5.5vw,5.5rem)] font-extrabold leading-[1.05] tracking-tight max-w-5xl">
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40">Real-time safety for</span>{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-[#60a5fa] to-[#a78bfa]">electric fleets.</span>
        </h1>

        <p className="relative z-10 mt-7 max-w-2xl text-lg leading-8 text-ink-soft">
          Track riders, coordinate incident response, and automate compliance — all from one command center built for motorcycle fleet operations across Africa.
        </p>

        <div className="relative z-10 mt-10 flex flex-wrap justify-center gap-4">
          {hasSession ? (
            <Link href="/live" className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:scale-105 transition-all">
              Open dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:scale-105 transition-all">
                Enter command center <ArrowRight size={16} />
              </Link>
              <Link href="/create-account" className="glass-panel inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm font-semibold text-ink hover:bg-surface-hover transition-colors">
                Request fleet access
              </Link>
            </>
          )}
        </div>

        {/* Metrics Bar */}
        <div className="relative z-10 mt-20 w-full max-w-4xl">
          <div className="glass-panel rounded-2xl p-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line/30 rounded-[14px] overflow-hidden">
              {metrics.map((m) => (
                <div key={m.label} className="bg-[var(--background-subtle)] p-6 text-left flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-accent">
                    {m.icon}
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">{m.label}</span>
                  </div>
                  <p className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="relative z-10 mt-16 flex flex-col items-center gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted">Trusted by fleet operators</p>
          <div className="flex flex-wrap justify-center gap-6">
            {trustedBy.map((name) => (
              <span key={name} className="text-sm font-semibold text-ink-faint/60">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Bento Grid ── */}
      <section id="features" className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
            <Radar size={12} /> Platform capabilities
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            Everything dispatch needs.{' '}
            <span className="text-ink-soft">Nothing they don&apos;t.</span>
          </h2>
          <p className="max-w-2xl text-base leading-7 text-ink-muted mt-1">
            Manage riders, devices, incidents, and partner reporting from one real-time operations hub.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-5">
          {featureRows.map((f) => (
            <article
              key={f.title}
              className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-accent/20 hover:shadow-[0_0_40px_rgba(59,130,246,0.08)] ${f.span}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  {f.icon}
                </span>
                <div className="mt-auto">
                  <h3 className="text-lg font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft max-w-sm">{f.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Dashboard Preview ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-line/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">Live map</p>
                  <h3 className="mt-1 text-lg font-bold">Street-level fleet visibility</h3>
                </div>
                <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">
                  Live demo
                </span>
              </div>
            </div>
            <div
              className="h-[320px]"
              style={{
                backgroundImage:
                  'linear-gradient(to top, rgba(11,15,25,0.95), rgba(11,15,25,0.3)), url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="flex h-full flex-col justify-end p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile label="Active zones" value="12" accent="accent" />
                  <StatTile label="Live riders" value="847" accent="success" />
                  <StatTile label="Open alerts" value="6" accent="warning" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {highlights.map((item) => (
              <article key={item.title} className="glass-panel rounded-2xl p-5 flex items-start gap-4 hover:-translate-y-0.5 transition-transform">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  {item.icon}
                </span>
                <div>
                  <h3 className="text-sm font-bold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
            <Zap size={12} /> Quick setup
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Launch in three steps.</h2>
          <p className="text-base text-ink-muted max-w-lg">From device provisioning to live monitoring in minutes, not months.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {workflowSteps.map((step) => (
            <div key={step.num} className="glass-panel rounded-2xl p-7 h-full flex flex-col gap-5 hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white text-sm font-extrabold shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  {step.num}
                </span>
                <h3 className="text-lg font-bold">{step.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefits + Testimonials ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">Why Fleet OS</p>
            <h2 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">Built for safety, compliance, and growth.</h2>
            <p className="mt-3 text-sm text-ink-soft leading-relaxed max-w-lg">
              Coordinate dispatch teams, guide riders, and meet compliance requirements with clear workflows and reliable data.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {benefits.map((b) => (
                <div key={b.title} className="rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-5 hover:-translate-y-0.5 transition-transform">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    {b.icon}
                  </span>
                  <h3 className="mt-4 text-sm font-bold">{b.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">{b.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">What operators say</p>
            <h3 className="mt-3 text-xl font-bold">Trusted by mobility teams.</h3>
            <div className="mt-6 space-y-4">
              {testimonials.map((t) => (
                <figure key={t.name} className="rounded-xl border border-line/50 bg-black/20 px-5 py-4">
                  <blockquote className="text-sm leading-relaxed text-ink-soft">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-3 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink">{t.name}</p>
                      <p className="text-[10px] text-ink-muted">{t.org}</p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto w-full max-w-7xl px-6 py-24 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/8 blur-[150px] rounded-full pointer-events-none" />

        <div className="flex flex-col items-center text-center gap-4 mb-16 relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
            Pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight max-w-2xl">Choose a plan that scales with your fleet.</h2>
          <p className="text-base text-ink-muted">Transparent pricing. No hidden fees. Cancel anytime.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 relative z-10 items-stretch">
          {pricingPlans.map((plan) => (
            <div
              key={plan.title}
              className={`flex flex-col rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${
                plan.featured
                  ? 'relative border-2 border-accent bg-accent/[0.07] shadow-[0_0_30px_rgba(59,130,246,0.2)] lg:scale-[1.05] z-10'
                  : 'glass-panel'
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                  Most Popular
                </div>
              )}
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">{plan.title}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                {plan.period && <span className="text-sm text-ink-muted">{plan.period}</span>}
              </div>
              <p className="mt-3 text-sm text-ink-soft leading-relaxed min-h-[48px]">{plan.description}</p>

              <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-line to-transparent" />

              <ul className="space-y-3 text-sm flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                      <BadgeCheck size={12} />
                    </span>
                    <span className="text-ink-soft">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/create-account?plan=${plan.slug}`}
                className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all hover:scale-105 ${
                  plan.featured
                    ? 'bg-accent text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    : 'glass-panel text-white hover:bg-surface-hover'
                }`}
              >
                Get started <ChevronRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-background to-background px-8 py-12 md:px-12">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent/15 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-lg">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">Ready to deploy</p>
              <h2 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">Turn on safer mobility for every rider.</h2>
              <p className="mt-3 text-sm text-ink-soft leading-relaxed">
                Launch the command center in minutes. Expand into rider scoring and partner reporting as your operations grow.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row shrink-0">
              {hasSession ? (
                <Link href="/live" className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] hover:scale-105 transition-transform">
                  Open dashboard <ArrowRight size={14} />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] hover:scale-105 transition-transform">
                    Sign in <ArrowRight size={14} />
                  </Link>
                  <Link href="/create-account" className="inline-flex items-center justify-center rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink hover:bg-surface-hover transition">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-line/50">
        <div className="mx-auto w-full max-w-7xl px-6 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent">
                  <Bike size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">eMoto</p>
                  <p className="text-sm font-bold">Fleet OS</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-ink-muted max-w-[200px]">Smart mobility command center for electric motorcycle fleets.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted mb-4">Product</p>
              <ul className="space-y-2.5 text-sm text-ink-soft">
                <li><a href="#features" className="hover:text-ink transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-ink transition">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-ink transition">How it works</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted mb-4">Platform</p>
              <ul className="space-y-2.5 text-sm text-ink-soft">
                <li className="flex items-center gap-2"><Users2 size={13} /> Rider app</li>
                <li className="flex items-center gap-2"><Cpu size={13} /> Partner API</li>
                <li className="flex items-center gap-2"><Activity size={13} /> Compliance</li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted mb-4">Access</p>
              <ul className="space-y-2.5 text-sm text-ink-soft">
                <li><Link href="/login" className="hover:text-ink transition">Sign in</Link></li>
                <li><Link href="/create-account" className="hover:text-ink transition">Create account</Link></li>
                <li><Link href="/forgot-password" className="hover:text-ink transition">Reset password</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-line/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-muted">&copy; 2026 eMoto Safety &amp; Fleet OS. All rights reserved.</p>
            <div className="flex gap-6 text-xs text-ink-muted">
              <a href="#" className="hover:text-ink transition">Privacy</a>
              <a href="#" className="hover:text-ink transition">Terms</a>
              <a href="#" className="hover:text-ink transition">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

function StatTile({ label, value, accent }: { label: string; value: string; accent: 'accent' | 'success' | 'warning' }) {
  const colors = {
    accent: 'text-accent',
    success: 'text-success-ink',
    warning: 'text-warning-ink',
  };

  return (
    <div className="rounded-xl border border-line/50 bg-black/40 backdrop-blur-md px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${colors[accent]}`}>{value}</p>
    </div>
  );
}
