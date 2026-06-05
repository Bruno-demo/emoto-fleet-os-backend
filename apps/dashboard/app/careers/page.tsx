import type { Metadata } from 'next';
import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  Briefcase,
  MapPin,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Careers | Join the Future of Electric Mobility',
  description: "Join our Kigali tech lab in Kiyovu to build the software engine for East Africa's clean energy transition. View open roles for IoT engineers, React Native developers, and fleet coordinators.",
  keywords: [
    'e-moto careers',
    'Kigali developer jobs',
    'IoT engineer vacancies Rwanda',
    'React Native jobs Kigali',
    'mobility tech careers',
  ],
  alternates: {
    canonical: '/careers',
  },
};

export default function CareersPage() {
  const jobs = [
    {
      title: 'Senior IoT & Telemetry Engineer',
      location: 'Kigali, Rwanda (Hybrid)',
      type: 'Full-Time',
      comp: 'RWF 3,500,000 - 4,500,000 / month',
      desc: 'Lead the stream-processing optimizations, scale MQTT telemetry ingest clusters, configure device parsers (e.g. SinoTrack, BLE boards), and integrate GPRS pipelines securely.',
    },
    {
      title: 'React Native / Expo Mobile Developer',
      location: 'East Africa (Remote Allowed)',
      type: 'Full-Time',
      comp: 'RWF 2,800,000 - 3,800,000 / month',
      desc: 'Iterate on the digital key locks, improve Bluetooth Low Energy connectivity models, customize battery swapping interfaces, and polish offline-first telemetry caching states.',
    },
    {
      title: 'Operations & Fleet Safety Coordinator',
      location: 'Kigali, Rwanda (On-Site)',
      type: 'Full-Time',
      comp: 'RWF 1,500,000 - 2,000,000 / month',
      desc: 'Maintain Kigali dispatch workflows, manage hospital slow zone bounds, review critical incident telemetry audits, and serve as the main link with insurance providers.',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-accent/[0.04] blur-[120px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Sparkles size={12} className="text-accent" />
          Join the Future of Mobility
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight mt-4">
          Accelerate Clean Transit Systems
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl mx-auto text-base text-zinc-400">
          Help us build the software engine behind East Africa&apos;s transition to safe, carbon-neutral, and smart electric motorcycle fleets.
        </p>
      </section>

      {/* Jobs Listing */}
      <section className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="space-y-6">
          <div className="border-b border-white/[0.06] pb-4 text-left">
            <h2 className="text-lg font-bold text-white">Active Openings</h2>
            <p className="text-xs text-zinc-500 mt-1">Join our Kigali tech lab and co-author the next era of e-mobility.</p>
          </div>

          <div className="space-y-4">
            {jobs.map((job, i) => (
              <div
                key={i}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all text-left flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base md:text-lg font-bold text-white group-hover:text-accent transition-colors">
                      {job.title}
                    </h3>
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold text-accent">
                      {job.type}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={12} />
                      {job.comp}
                    </span>
                  </div>

                  <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                    {job.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.04] flex justify-end">
                  <a
                    href="mailto:careers@emotofleet.com"
                    className="inline-flex items-center gap-1.5 text-xs text-white font-semibold transition hover:text-accent group-hover:translate-x-0.5"
                  >
                    Apply for Position <ArrowRight size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
