import type { Metadata } from 'next';
import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  Calendar,
  Clock,
  ArrowRight,
  Newspaper,
  Tag,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'E-Moto Fleet Journal | Tech & Safety Insights',
  description: 'Explore deep-dives into IoT telemetry, battery swap station protocols, driver coaching strategies, and carbon credit certifications from our engineering and ops teams in Kigali.',
  keywords: [
    'e-moto blog',
    'MQTT telemetry Kigali',
    'GPS tracker calibration',
    'rider coaching safety scorecard',
    'decarbonizing Kigali',
  ],
  alternates: {
    canonical: '/blog',
  },
};

export default function BlogPage() {
  const posts = [
    {
      title: 'Decarbonizing Kigali: Grid Capacity & Electric Motos',
      desc: 'Analyzing how battery swap stations, decentralized grid storage, and 100,000 electric motorcycle taxis will transform urban transit and local grids in Rwanda over the next decade.',
      date: 'May 20, 2026',
      readTime: '6 min read',
      tag: 'E-Mobility',
      tagColor: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      title: 'Active Coaching: Reducing Fleet Insurance Claims by 40%',
      desc: 'How real-time driver scorecards and sub-second accelerometer alerts are transforming micro-insurance claims processes, lowering incident rates, and raising fleet coefficients.',
      date: 'May 12, 2026',
      readTime: '5 min read',
      tag: 'Safety & Risk',
      tagColor: 'text-accent bg-accent/15',
    },
    {
      title: 'MQTT vs Cellular GPRS: Fleet Telemetry Benchmarked',
      desc: 'An in-depth technical analysis comparing protocol data footprints, packet delivery speed, and reconnection behaviors over low-bandwidth cellular connections in East Africa.',
      date: 'April 28, 2026',
      readTime: '8 min read',
      tag: 'Engineering',
      tagColor: 'text-purple-400 bg-purple-500/10',
    },
  ];

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-accent/[0.04] blur-[120px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Newspaper size={12} className="text-accent" />
          Strategic &amp; Technical Insights
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight mt-4">
          The E-Moto Fleet Journal
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl mx-auto text-base text-zinc-400">
          Explore technical insights, fleet safety guides, and operational updates from our engineering and logistics research teams in Kigali.
        </p>
      </section>

      {/* Blog Cards Grid */}
      <section className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="space-y-8">
          {posts.map((p, i) => (
            <article
              key={i}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 md:p-8 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-300 flex flex-col justify-between text-left"
            >
              <div className="space-y-4">
                {/* Meta details */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${p.tagColor}`}>
                    <Tag size={10} />
                    {p.tag}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {p.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {p.readTime}
                  </span>
                </div>
                
                {/* Title */}
                <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-accent transition-colors leading-tight">
                  {p.title}
                </h2>
                
                {/* Description */}
                <p className="text-xs md:text-sm leading-relaxed text-zinc-400">
                  {p.desc}
                </p>
              </div>

              {/* Read button */}
              <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-zinc-500">
                <span className="text-zinc-600">By E-Moto Ops Lab</span>
                <span className="inline-flex items-center gap-1 text-accent font-semibold group-hover:translate-x-1 transition-transform">
                  Read Article <ArrowRight size={12} />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </InfoPageLayout>
  );
}
