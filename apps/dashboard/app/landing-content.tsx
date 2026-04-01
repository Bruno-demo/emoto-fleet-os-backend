'use client';

import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  Bike,
  Command,
  Cpu,
  LocateFixed,
  MapPinned,
  ShieldCheck,
  SignalHigh,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

const highlights = [
  {
    title: 'Live fleet command center',
    description:
      'Monitor every ride, incident, and command acknowledgement in one operational view.',
    icon: <Command size={18} />,
  },
  {
    title: 'Safety-grade telemetry',
    description:
      'Track speed, battery, and crash signals with a rules engine tuned for urban mobility.',
    icon: <Activity size={18} />,
  },
  {
    title: 'Rider-ready workflows',
    description: 'Fast onboarding, SOS escalation, and ride scoring built for growing fleets.',
    icon: <Users size={18} />,
  },
];

const featureRows = [
  {
    title: 'Real-time location intelligence',
    description:
      'Map live bike states, last-seen times, and geofence alerts with sub-second refresh.',
    icon: <MapPinned size={18} />,
  },
  {
    title: 'Secure device control',
    description: 'Safety checks guard lock/unlock commands and every action is fully auditable.',
    icon: <ShieldCheck size={18} />,
  },
  {
    title: 'Low-bandwidth friendly',
    description: 'Built for African connectivity realities with graceful offline behavior.',
    icon: <SignalHigh size={18} />,
  },
  {
    title: 'Predictive insights',
    description: 'Trips, events, and scoring summaries reveal which bikes need attention first.',
    icon: <Cpu size={18} />,
  },
];

const metrics = [
  { label: 'Telemetry latency', value: '< 2s' },
  { label: 'Incident response', value: 'Real-time' },
  { label: 'Fleet uptime', value: '99.9%' },
];

const personas = [
  {
    title: 'Riders',
    description: 'Clear coaching, SOS access, and safer routes with minimal taps.',
    icon: <Bike size={18} />,
  },
  {
    title: 'Dispatch',
    description: 'Live triage, incident resolution, and command delivery in one view.',
    icon: <Command size={18} />,
  },
  {
    title: 'Fleet admins',
    description: 'Policy controls, audit trails, and partner reporting with RBAC.',
    icon: <ShieldCheck size={18} />,
  },
];

const platformFeatures = [
  {
    title: 'Live map intelligence',
    description: 'Real-time bike state, geofence context, and location safety overlays.',
    icon: <MapPinned size={18} />,
  },
  {
    title: 'Incident orchestration',
    description: 'Crash, SOS, and theft workflows with evidence packs ready to export.',
    icon: <Activity size={18} />,
  },
  {
    title: 'Secure command control',
    description: 'Safety-gated lock and unlock actions with delivery acknowledgements.',
    icon: <ShieldCheck size={18} />,
  },
  {
    title: 'Trip scoring',
    description: 'Rider scorecards and weekly KPIs built for coaching and incentives.',
    icon: <Cpu size={18} />,
  },
  {
    title: 'Partner-ready data',
    description: 'Insurer summaries and webhooks without exposing raw telemetry.',
    icon: <BadgeCheck size={18} />,
  },
  {
    title: 'Low bandwidth UX',
    description: 'Responsive UI that stays usable on mobile-first African networks.',
    icon: <SignalHigh size={18} />,
  },
];

const workflowSteps = [
  {
    title: 'Connect devices',
    description: 'Provision a device UID once and bind it to a bike profile.',
  },
  {
    title: 'Stream telemetry',
    description: 'Signed data feeds the rules engine and live state in seconds.',
  },
  {
    title: 'Act instantly',
    description: 'Respond to SOS, crashes, and risk events with clear workflows.',
  },
];

// Renders the dashboard marketing landing page for unauthenticated visitors.
export default function LandingContent() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,118,110,0.14),transparent_28%),var(--background)] text-ink">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-ink text-white shadow-[0_10px_30px_rgba(15,23,42,0.28)]">
            <Bike size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
              E-Moto Safety
            </p>
            <p className="text-lg font-semibold text-ink">Fleet OS</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-[12px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-[var(--shadow-soft)]"
          >
            Sign in
          </Link>
          <Link
            href="/create-account"
            className="rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(21,94,239,0.3)]"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="grid gap-10 rounded-[32px] border border-line bg-surface px-7 py-10 shadow-[var(--shadow-strong)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
              <LocateFixed size={14} />
              Live fleet visibility
            </span>
            <h1 className="font-display text-[clamp(2.2rem,1.9rem+1.6vw,3.5rem)] font-semibold leading-tight text-ink">
              A safer, smarter way to run electric motorcycle fleets.
            </h1>
            <p className="text-base leading-7 text-ink-soft">
              E-Moto Fleet OS brings real-time telematics, incident workflows, and command
              operations into a single dashboard. Built for riders, dispatch, and safety teams
              across Africa.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-[14px] bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(21,94,239,0.3)]"
              >
                Enter command center
              </Link>
              <Link
                href="/create-account"
                className="inline-flex items-center justify-center rounded-[14px] border border-line bg-white px-5 py-3 text-sm font-semibold text-ink"
              >
                Request fleet access
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-[20px] border border-line bg-surface-muted px-4 py-4 text-center"
                >
                  <p className="font-display text-2xl font-semibold text-ink">{metric.value}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-muted">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1">
                Dashboard
              </span>
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1">
                Rider app
              </span>
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1">
                Partner API
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {highlights.map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-line bg-white px-5 py-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
                    {item.icon}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{item.description}</p>
                  </div>
                </div>
              </article>
            ))}

            <div className="rounded-[24px] border border-line bg-surface-muted px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                Command preview
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <HeroStatCard label="Live bikes" value="128" hint="online now" />
                <HeroStatCard
                  label="Open incidents"
                  value="4"
                  hint="triage ready"
                  tone="danger"
                />
                <HeroStatCard label="Avg score" value="86.4" hint="weekly" tone="success" />
                <HeroStatCard label="Commands sent" value="31" hint="today" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">
              Built for operators
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
              Everything dispatch needs to respond faster.
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              See crashes, SOS signals, and risky behaviors as they happen. Coordinate riders,
              assign actions, and keep a complete audit trail for every incident.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {featureRows.map((feature) => (
                <div key={feature.title} className="flex gap-3">
                  <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-ink text-white">
                    {feature.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{feature.title}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">
              Trust & security
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
              Secure by design for riders and fleets.
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Role-based access, encrypted device secrets, and signed telemetry keep your fleet data
              protected at every step.
            </p>

            <div className="mt-6 space-y-4">
              <TrustRow
                icon={<BadgeCheck size={18} />}
                title="Fleet isolation"
                description="Data is always scoped to one fleet to prevent cross-visibility."
              />
              <TrustRow
                icon={<ShieldCheck size={18} />}
                title="Signed telemetry"
                description="Device messages are verified before storage and scoring."
              />
              <TrustRow
                icon={<Activity size={18} />}
                title="Audit-ready"
                description="Every command and incident action is tracked for compliance."
              />
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">
            Who it serves
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
            One platform for riders, dispatch, and leadership.
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Tailored workflows keep every persona focused on their most important decisions.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {personas.map((persona) => (
              <div
                key={persona.title}
                className="rounded-[22px] border border-line bg-surface-muted px-5 py-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-accent">
                  {persona.icon}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-ink">
                  {persona.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{persona.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">
            Platform capabilities
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
            Built end-to-end for safety, compliance, and growth.
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platformFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[22px] border border-line bg-white px-5 py-5 shadow-[var(--shadow-soft)]"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
                  {feature.icon}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[0.55fr_0.45fr]">
          <div className="rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">
              How it works
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
              Launch the system in three steps.
            </h2>
            <div className="mt-5 space-y-4">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-ink text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">
              Service packages
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
              Start with safety, grow into analytics.
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-ink-soft">
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Live command center + incident workflows
              </li>
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Rider scoring, trip reports, and coaching
              </li>
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Partner exports and insurer dashboards
              </li>
            </ul>
            <div className="mt-6 rounded-[20px] border border-line bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                Deployment ready
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Works with existing devices and scales to thousands of bikes with zero downtime.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-line bg-ink px-8 py-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                Ready to deploy
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold">
                Turn on safer mobility for every rider in your fleet.
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Launch the command center in minutes, then expand into rider scoring and partner
                reporting as your operations grow.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-[14px] bg-white px-5 py-3 text-sm font-semibold text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/create-account"
                className="inline-flex items-center justify-center rounded-[14px] border border-white/20 px-5 py-3 text-sm font-semibold text-white"
              >
                Create account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10">
        <div className="flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <p>(C) 2026 E-Moto Safety & Fleet OS. All rights reserved.</p>
          <p>Secure operations for riders, dispatch, and fleet managers.</p>
        </div>
      </footer>
    </div>
  );
}

// Renders a miniature metric tile for the hero command preview.
function HeroStatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  const toneMap = {
    default: 'border-line bg-white text-ink',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <div className={`rounded-[16px] border px-4 py-4 ${toneMap[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs opacity-70">{hint}</p>
    </div>
  );
}

// Displays a compact trust item for the landing page safety panel.
function TrustRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-white/10 bg-white/5 px-4 py-4">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/10 text-white">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/70">{description}</p>
      </div>
    </div>
  );
}
