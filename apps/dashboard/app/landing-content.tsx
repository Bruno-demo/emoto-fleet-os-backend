'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  ChevronRight,
  ClipboardList,
  Command,
  Cpu,
  Gauge,
  Globe2,
  LocateFixed,
  Lock,
  MapPin,
  Minus,
  Monitor,
  Plus,
  Shield,
  ShieldCheck,
  Signal,
  Siren,
  Sparkles,
  Users2,
  Menu,
  X,
} from 'lucide-react';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

/* ─── Data ────────────────────────────────────────────── */

const features = [
  { icon: <LocateFixed size={20} />, title: 'Live Fleet Tracking', desc: 'See every bike and rider on the map in real-time with sub-second telemetry updates and geofence alerts.' },
  { icon: <Siren size={20} />, title: 'Incident Management', desc: 'Crash and SOS dispatch with escalation workflows, evidence collection, and full incident timelines.' },
  { icon: <Signal size={20} />, title: 'Remote Commands', desc: 'Lock, unlock, and send OTA commands to any device with full audit logging and confirmation.' },
  { icon: <Gauge size={20} />, title: 'Trip Intelligence', desc: 'Trip scoring, rider coaching insights, and fleet-wide performance analytics across all operations.' },
  { icon: <Shield size={20} />, title: 'Safety Automation', desc: 'Detect risky behavior instantly and turn it into automated dispatch workflows before incidents escalate.' },
  { icon: <BatteryCharging size={20} />, title: 'Battery Monitoring', desc: 'Track battery health, charge cycles, voltage trends, and swap station proximity for every bike.' },
  { icon: <Globe2 size={20} />, title: 'Partner API Access', desc: 'Scoped API tokens for insurers, regulators, and partners with granular data access controls.' },
  { icon: <Users2 size={20} />, title: 'Rider Management', desc: 'Onboard riders, manage profiles, track performance scores, and handle compliance documentation.' },
  { icon: <MapPin size={20} />, title: 'Zone Management', desc: 'Define operational zones, set speed limits, configure geofence alerts, and manage restricted areas.' },
  { icon: <ClipboardList size={20} />, title: 'Audit Logging', desc: 'Complete audit trail for every action, command, and configuration change across your fleet.' },
  { icon: <Monitor size={20} />, title: 'Real-time Monitoring', desc: 'Monitor CPU, memory, device health, and network status across your entire fleet infrastructure.' },
  { icon: <Lock size={20} />, title: 'Enterprise Security', desc: 'Role-based access control, signed telemetry, encrypted channels, and compliance-ready data handling.' },
];

const showcaseTabs = [
  { id: 'live-map', label: 'Live Map', desc: 'Track every bike and rider in real-time on an interactive map with geofence overlays, zone boundaries, and live status indicators. Filter by status, zone, or alert level.' },
  { id: 'incidents', label: 'Incidents', desc: 'Manage crash and SOS incidents with guided dispatch workflows. View timelines, attach evidence, escalate to partners, and track resolution progress in one unified view.' },
  { id: 'riders', label: 'Riders', desc: 'Comprehensive rider profiles with safety scores, trip history, compliance status, and performance analytics. Onboard new riders and manage documentation.' },
  { id: 'devices', label: 'Devices', desc: 'Monitor device health, firmware versions, connectivity status, and telemetry quality. Provision new devices and manage OTA updates across your fleet.' },
  { id: 'analytics', label: 'Analytics', desc: 'Fleet-wide KPI dashboards with incident trends, rider performance distributions, operational efficiency metrics, and compliance reporting tools.' },
  { id: 'commands', label: 'Commands', desc: 'Send secure lock, unlock, and configuration commands to any device. View command history with delivery confirmation and full audit trails.' },
];

const stats = [
  { label: 'Active Bikes Managed', value: 1284, suffix: '+' },
  { label: 'Incidents Resolved', value: 96, suffix: '%' },
  { label: 'Avg Response Time', value: 2.4, suffix: 'min', decimals: 1 },
  { label: 'Platform Uptime', value: 99.9, suffix: '%', decimals: 1 },
];

const testimonials = [
  { quote: 'We cut our incident response time by over 60% while improving rider safety scores in just two months.', name: 'Dispatch Lead', handle: '@kigali_logistics', org: 'Kigali Logistics' },
  { quote: 'The command center gives us confidence when deploying hundreds of bikes across the city.', name: 'Fleet Ops Director', handle: '@urban_mobility', org: 'Urban Mobility' },
  { quote: 'Real-time telemetry and secure audit trails are essential for our insurer partnerships.', name: 'Risk Manager', handle: '@regional_insurer', org: 'Regional Insurer' },
  { quote: 'Fleet OS transformed our operations. We went from reactive to proactive safety in weeks.', name: 'Operations Lead', handle: '@saferide_africa', org: 'SafeRide Africa' },
  { quote: 'The rider scoring system helped us identify and coach high-risk riders before incidents happen.', name: 'Safety Director', handle: '@motoguard', org: 'MotoGuard' },
  { quote: 'Partner API integration with our insurance platform was seamless. Compliance reporting is now automatic.', name: 'Tech Lead', handle: '@greenwheel', org: 'GreenWheel' },
];

const faqs = [
  { q: 'What is eMoto Fleet OS?', a: 'eMoto Fleet OS is a real-time safety and operations platform for electric motorcycle fleets. It provides live tracking, incident management, rider scoring, remote device commands, and compliance reporting — all from one command center.' },
  { q: 'How does Fleet OS improve rider safety?', a: 'Fleet OS detects risky behavior like harsh braking, speeding, and erratic riding in real-time. It automatically triggers alerts, scores rider performance, and provides coaching insights to reduce incidents before they happen.' },
  { q: 'Do I need to purchase hardware for Fleet OS?', a: 'No device setup or hardware purchase fees are required. GPS hardware devices remain the exclusive company property of eMoto Fleet OS and are provided to you for fleet management and telemetry.' },
  { q: 'What databases and infrastructure does Fleet OS use?', a: 'Fleet OS runs on PostgreSQL with TimescaleDB for time-series telemetry data, Redis for real-time caching, and MQTT for device communication. The platform is containerized with Docker for easy deployment.' },
  { q: 'Can I integrate Fleet OS with my existing systems?', a: 'Yes. Fleet OS provides a comprehensive REST API and webhook system for integration with insurance platforms, regulatory systems, and third-party analytics tools. Partner API tokens provide scoped data access.' },
  { q: 'How does pricing work?', a: 'Subscription rates are based directly on your fleet type: 10,000 RWF/bike/month for Cooperative and Individual fleets, and 15,000 RWF/bike/month for Commercial Delivery fleets. Insurance partners receive dedicated telemetry access with custom terms. There are $0$ device setup fees.' },
  { q: 'Is Fleet OS open source?', a: 'Fleet OS is a commercial platform with enterprise-grade security and support. We offer a demo environment for evaluation and can provide custom trials for qualified fleet operators.' },
  { q: 'What kind of support do you offer?', a: 'Cooperative and Individual plans include standard support. Delivery fleets receive priority support with faster response times. Insurance plans include dedicated support, custom SLA, and onboarding assistance.' },
  { q: 'How do I request a feature or report a bug?', a: 'You can reach our team through the dashboard support channel, email, or through your dedicated account manager on Insurance plans. We actively incorporate operator feedback into our roadmap.' },
  { q: 'Is there a limit on the number of bikes?', a: 'No. Fleet OS scales from small fleets of 10 bikes to enterprise operations with thousands. Our infrastructure auto-scales to handle any fleet size with consistent real-time performance.' },
];

interface PricingPlanItem {
  slug: string;
  title: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  featured?: boolean;
  promoTag?: string;
}

const pricingPlans: PricingPlanItem[] = [
  {
    slug: 'coop-individual',
    title: 'Cooperative & Individual',
    price: '10,000 RWF',
    period: '/ bike / month',
    description: 'Designed for motorcycle cooperatives and individual personal fleet owners.',
    features: [
      'Live map + real-time alerts',
      'Remote bike commands (lock/unlock)',
      'Rider scoring & safety metrics',
      'Financial & lease tracking',
      '0 RWF Device Setup Fee',
      'Hardware remains eMoto company property',
    ],
    featured: true,
  },
  {
    slug: 'delivery',
    title: 'Delivery Fleet',
    price: '15,000 RWF',
    period: '/ bike / month',
    description: 'Tailored for high-volume commercial delivery and courier operations.',
    features: [
      'Everything in Cooperative Plan',
      'Delivery dispatch & route tracking',
      'Advanced incident & crash workflows',
      'Trip analytics & compliance reports',
      '0 RWF Device Setup Fee',
      'Hardware remains eMoto company property',
    ],
  },
  {
    slug: 'insurance',
    title: 'Insurance Partner',
    price: 'Custom',
    period: '',
    description: 'For insurance companies and risk management partners.',
    features: [
      'Access to covered fleet telemetry',
      'Partner API credentials',
      'Dedicated insurance support',
      'Automated claims verification',
      'Custom integrations',
    ],
  },
];

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Live Map', href: '/live' },
    { label: 'Partner API', href: '#features' },
  ],
  Platform: [
    { label: 'Rider App', href: '/rider-app' },
    { label: 'Fleet Dashboard', href: '/login' },
    { label: 'Documentation', href: '/docs' },
    { label: 'Compliance', href: '/compliance' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '/careers' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
};

/* ─── Animated Counter ────────────────────────────────── */

function AnimatedStat({ value, suffix, decimals = 0 }: { value: number; suffix: string; decimals?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 2000;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(eased * value);
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-5xl md:text-6xl font-extrabold tracking-tight text-white">
      {decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toLocaleString()}
      <span className="text-accent">{suffix}</span>
    </div>
  );
}

/* ─── FAQ Item ────────────────────────────────────────── */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.08]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-6 text-left transition-colors hover:text-white group"
      >
        <span className="text-[15px] font-semibold text-white/90 group-hover:text-white pr-4">{question}</span>
        <span className="shrink-0 text-zinc-500 transition-transform duration-200">
          {open ? <Minus size={18} /> : <Plus size={18} />}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[500px] pb-6' : 'max-h-0'}`}
      >
        <p className="text-sm leading-relaxed text-zinc-400 max-w-3xl">{answer}</p>
      </div>
    </div>
  );
}

interface LandingPricingTier {
  planCode: string;
  monthlyRatePerBike: number;
  setupFeePerBike: number;
  description: string | null;
}

/* ─── Main Component ──────────────────────────────────── */

export default function LandingContent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('live-map');
  const [hasSession, setHasSession] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pricingTiers, setPricingTiers] = useState<LandingPricingTier[] | null>(null);

  useEffect(() => {
    const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
    fetch(`${API_BASE_URL}/me`, { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          setHasSession(true);
        } else {
          setHasSession(false);
        }
      })
      .catch(() => {
        setHasSession(false);
      });

    async function loadPricing() {
      try {
        const res = await fetch(`${API_BASE_URL}/billing/pricing`);
        if (!res.ok) return;
        const tiers = (await res.json()) as LandingPricingTier[];
        setPricingTiers(tiers);
      } catch (err) {
        console.error('Failed to load dynamic pricing:', err);
      }
    }
    loadPricing();
  }, []);

  // Dynamic Pricing Rates & Plan Mapping
  const demoTier = pricingTiers?.find(t => t.planCode === 'DEMO');
  const premiumTier = pricingTiers?.find(t => t.planCode === 'PREMIUM');
  const coreRateStr = demoTier ? `${demoTier.monthlyRatePerBike.toLocaleString()} RWF/bike/month` : '5,000 RWF/bike/month';
  const premiumRateStr = premiumTier ? `${premiumTier.monthlyRatePerBike.toLocaleString()} RWF/bike/month` : '10,000 RWF/bike/month';

  const localizedFaqItems = useMemo(() => {
    return faqs.map((faq) => {
      if (faq.q === 'How does pricing work?') {
        return {
          q: t('faq_pricing_q', faq.q),
          a: t('faq_pricing_a', faq.a)
            .replace('{core}', coreRateStr)
            .replace('{premium}', premiumRateStr)
        };
      }
      return {
        q: t('faq_q_' + faq.q.toLowerCase().replace(/[^a-z0-9]/g, '_'), faq.q),
        a: t('faq_a_' + faq.q.toLowerCase().replace(/[^a-z0-9]/g, '_'), faq.a),
      };
    });
  }, [t, coreRateStr, premiumRateStr]);

  const localizedPlans = useMemo(() => {
    return pricingPlans.map((plan) => {
      const matchingTier = pricingTiers?.find((t) => 
        (plan.slug === 'safety-core' && t.planCode === 'DEMO') ||
        (plan.slug === 'operations-plus' && t.planCode === 'PREMIUM') ||
        (plan.slug === 'insurance' && t.planCode === 'INSURANCE')
      );
      
      const priceStr = matchingTier 
        ? (matchingTier.monthlyRatePerBike === 0 && plan.slug === 'insurance' ? 'Custom' : `${matchingTier.monthlyRatePerBike.toLocaleString()} RWF`)
        : plan.price;
        
      const setupFeeStr = matchingTier
        ? matchingTier.setupFeePerBike.toLocaleString()
        : '35,000';

      return {
        ...plan,
        title: t(plan.slug.replace('-', '_') + '_title', plan.title), // safety_core_title etc.
        price: priceStr,
        description: t(plan.slug.replace('-', '_') + '_desc', plan.description),
        features: plan.features.map(f => {
          if (f.includes('setup & install fee')) {
            return t('feat_setup_fee', '+ {fee} RWF device setup & install fee').replace('{fee}', setupFeeStr);
          }
          return t('feat_' + f.toLowerCase().replace(/[^a-z0-9]/g, '_'), f);
        })
      };
    });
  }, [t, pricingTiers]);
  const localizedFeatures = useMemo(() => {
    return features.map((f) => {
      const keyBase = f.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return {
        ...f,
        title: t(`feat_title_${keyBase}`, f.title),
        desc: t(`feat_desc_${keyBase}`, f.desc),
      };
    });
  }, [t]);

  const localizedShowcaseTabs = useMemo(() => {
    return showcaseTabs.map((tab) => {
      const keyBase = tab.id.replace('-', '_');
      return {
        ...tab,
        label: t(`showcase_label_${keyBase}`, tab.label),
        desc: t(`showcase_desc_${keyBase}`, tab.desc),
      };
    });
  }, [t]);

  const localizedStats = useMemo(() => {
    return stats.map((s) => {
      const keyBase = s.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return {
        ...s,
        label: t(`stat_label_${keyBase}`, s.label),
      };
    });
  }, [t]);

  const localizedTestimonials = useMemo(() => {
    return testimonials.map((test) => {
      const keyBase = test.org.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return {
        ...test,
        quote: t(`test_quote_${keyBase}`, test.quote),
        name: t(`test_name_${keyBase}`, test.name),
        org: t(`test_org_${keyBase}`, test.org),
      };
    });
  }, [t]);

  const localizedFooterLinks = useMemo(() => {
    const res: Record<string, typeof footerLinks.Product> = {};
    for (const [title, links] of Object.entries(footerLinks)) {
      const localizedTitle = t(`footer_col_${title.toLowerCase()}`, title);
      res[localizedTitle] = links.map((link) => ({
        ...link,
        label: t(`footer_link_${link.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, link.label),
      }));
    }
    return res;
  }, [t]);

  return (
    <div className="dark min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl" style={{colorScheme:'dark'}}>
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-ink shadow-sm group-hover:shadow-accent/40 transition-shadow">
              <Command size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                E-Moto
              </p>
              <p className="font-display text-sm font-bold text-white">Fleet OS</p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-[13px] font-medium md:flex" style={{color:'rgb(161,161,170)'}}>
            <a href="#features" className="transition hover:text-white" style={{color:'inherit'}}>{t('land_features')}</a>
            <a href="#showcase" className="transition hover:text-white" style={{color:'inherit'}}>{t('land_dashboard')}</a>
            <a href="#pricing" className="transition hover:text-white" style={{color:'inherit'}}>{t('land_pricing')}</a>
            <a href="#faq" className="transition hover:text-white" style={{color:'inherit'}}>{t('land_faq')}</a>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <LanguageSwitcher />
            {hasSession ? (
              <Link href="/overview" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition" style={{background:'white', color:'black'}}>
                {t('land_dashboard')} <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium transition hover:text-white" style={{color:'rgb(161,161,170)'}}>{t('signin')}</Link>
                <Link href="/create-account" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition" style={{background:'white', color:'black'}}>
                  {t('land_cta_setup')} <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white md:hidden"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-white/[0.06] bg-[#09090b] px-6 py-6 md:hidden space-y-6 animate-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-4 text-sm font-medium" style={{color:'rgb(161,161,170)'}}>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="transition hover:text-white">{t('land_features')}</a>
              <a href="#showcase" onClick={() => setMobileMenuOpen(false)} className="transition hover:text-white">{t('land_dashboard')}</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="transition hover:text-white">{t('land_pricing')}</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="transition hover:text-white">{t('land_faq')}</a>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.06]">
              <div className="flex justify-center mb-2">
                <LanguageSwitcher />
              </div>
              {hasSession ? (
                <Link
                  href="/overview"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
                  style={{background:'white', color:'black'}}
                >
                  {t('land_dashboard')} <ArrowRight size={14} />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition hover:text-white border border-white/[0.08]"
                    style={{color:'rgb(161,161,170)'}}
                  >
                    {t('signin')}
                  </Link>
                  <Link
                    href="/create-account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
                    style={{background:'white', color:'black'}}
                  >
                    {t('land_cta_setup')} <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-24 pb-20 lg:pt-32 lg:pb-28 flex flex-col items-center text-center">
        {/* Subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/[0.07] blur-[150px] rounded-full pointer-events-none" />

        <span className="relative z-10 mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <Sparkles size={12} className="text-accent" />
          {t('land_badge_cmd', 'Smart Mobility Command Center')}
        </span>

        <h1 className="relative z-10 text-[clamp(2.5rem,5.5vw,5rem)] font-extrabold leading-[1.08] tracking-tight max-w-4xl">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
            {t('land_hero_title').split('Electric Motorbike')[0]}
          </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-blue-400 to-purple-400">
            {t('land_hero_title').includes('Amashanyarazi') ? "Amagare y'Amashanyarazi" : "Electric Motorbike Fleets"}
          </span>
        </h1>

        <p className="relative z-10 mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          {t('land_hero_desc')}
        </p>

        <div className="relative z-10 mt-10 flex flex-wrap justify-center gap-4">
          {hasSession ? (
            <Link href="/overview" className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition" style={{background:'white',color:'black'}}>
              {t('land_dashboard')} <ArrowRight size={15} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition" style={{background:'white',color:'black'}}>
                {t('land_dashboard')} <ArrowRight size={15} />
              </Link>
              <Link href="/create-account" className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-6 py-3 text-sm font-medium transition hover:bg-white/[0.08]" style={{color:'rgb(212,212,216)'}}>
                {t('land_cta_request', 'Request Fleet Access')}
              </Link>
            </>
          )}
        </div>

        {/* Terminal command */}
        <div className="relative z-10 mt-12 w-full max-w-xl">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 font-mono text-sm text-zinc-400">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-3 w-3 rounded-full bg-red-500/60" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <span className="h-3 w-3 rounded-full bg-green-500/60" />
            </div>
            <code>
              <span className="text-zinc-500">$</span>{' '}
              <span className="text-accent">curl</span>{' '}
              <span className="text-ink-soft">-sSL https://emotofleet.com/setup.sh</span>{' '}
              <span className="text-zinc-500">|</span>{' '}
              <span className="text-accent">sh</span>
            </code>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <h2 className="text-3xl md:text-[40px] font-extrabold tracking-tight leading-tight max-w-3xl">
            {t('land_power_title', 'Powerful Fleet Management')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">{t('land_power_highlight', 'Tailored to You')}</span>
          </h2>
          <p className="max-w-2xl text-base leading-7 text-zinc-400 mt-2">
            {t('land_power_desc', "Unlock real-time fleet visibility, advanced rider safety, and flexible operations management — all with Fleet OS's operator-focused features.")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {localizedFeatures.map((f) => (
            <article
              key={f.title}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-400 group-hover:text-accent transition-colors">
                  {f.icon}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.desc}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Tabbed Showcase ── */}
      <section id="showcase" className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <h2 className="text-3xl md:text-[40px] font-extrabold tracking-tight leading-tight max-w-3xl">
            {t('land_control_title', 'Comprehensive Control of Your')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">{t('land_control_highlight', 'Fleet Operations')}</span>
          </h2>
          <p className="max-w-2xl text-base leading-7 text-zinc-400 mt-2">
            {t('land_control_desc', 'Simplify rider management, ensure robust monitoring, and coordinate fleet operations — all without the fuss.')}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {localizedShowcaseTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
              style={
                activeTab === tab.id
                  ? { background: 'white', color: 'black' }
                  : { color: 'rgb(113,113,122)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {localizedShowcaseTabs.map((tab) => (
            <div
              key={tab.id}
              className={`transition-opacity duration-300 ${activeTab === tab.id ? 'block' : 'hidden'}`}
            >
              <div className="p-8 md:p-12">
                <p className="text-base leading-relaxed text-zinc-400 max-w-3xl">{tab.desc}</p>
              </div>
              {/* Showcase image area */}
              <div className="relative h-[350px] md:h-[450px] bg-gradient-to-b from-white/[0.02] to-transparent border-t border-white/[0.06]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-zinc-600">
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8">
                      {tab.id === 'live-map' && <LocateFixed size={48} className="text-accent/60" />}
                      {tab.id === 'incidents' && <Siren size={48} className="text-accent/60" />}
                      {tab.id === 'riders' && <Users2 size={48} className="text-accent/60" />}
                      {tab.id === 'devices' && <Cpu size={48} className="text-accent/60" />}
                      {tab.id === 'analytics' && <Activity size={48} className="text-accent/60" />}
                      {tab.id === 'commands' && <Signal size={48} className="text-accent/60" />}
                    </div>
                    <span className="text-sm font-medium text-zinc-500">{t('showcase_dash_title', '{label} Dashboard').replace('{label}', tab.label)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <h2 className="text-3xl md:text-[40px] font-extrabold tracking-tight leading-tight">
            {t('land_stats_title', 'Fleet OS By the Numbers')}
          </h2>
          <p className="text-base text-zinc-400 max-w-lg">
            {t('land_stats_desc', "Real metrics from real fleet operations. Here's what the platform delivers.")}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {localizedStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
              <AnimatedStat value={s.value} suffix={s.suffix} decimals={s.decimals} />
              <p className="mt-4 text-sm text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <h2 className="text-3xl md:text-[40px] font-extrabold tracking-tight leading-tight">
            {t('land_testimonials_title', 'What Fleet Operators Say')}
          </h2>
          <p className="text-base text-zinc-400 max-w-lg">
            {t('land_testimonials_desc', 'Hear from the operators who transformed their fleet safety with Fleet OS.')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {localizedTestimonials.map((test) => (
            <figure key={test.name} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent">
                  {test.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{test.name}</p>
                  <p className="text-xs text-zinc-500">{test.handle}</p>
                </div>
              </div>
              <blockquote className="text-sm leading-relaxed text-zinc-400">
                &ldquo;{test.quote}&rdquo;
              </blockquote>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto w-full max-w-7xl px-6 py-24 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/[0.04] blur-[150px] rounded-full pointer-events-none" />

        <div className="flex flex-col items-center text-center gap-4 mb-16 relative z-10">
          <h2 className="text-3xl md:text-[40px] font-extrabold tracking-tight leading-tight max-w-2xl">
            {t('land_plans_title', 'Choose a Plan That Scales with Your Fleet')}
          </h2>
          <p className="text-base text-zinc-400">{t('land_plans_desc', 'Transparent pricing. No hidden fees. Cancel anytime.')}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 relative z-10 items-stretch">
          {localizedPlans.map((plan) => (
            <div
              key={plan.title}
              className={`flex flex-col rounded-xl p-8 transition-all duration-300 hover:-translate-y-1 ${
                plan.featured
                  ? 'relative border-2 border-accent bg-accent/[0.05] shadow-[0_0_30px_rgba(59,130,246,0.12)] lg:scale-[1.03] z-10'
                  : 'border border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white px-4 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                  {t('land_plans_popular', 'Most Popular')}
                </div>
              )}
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">{plan.title}</p>
              <div className="mt-4 flex items-baseline gap-1">
                {pricingTiers ? (
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                ) : (
                  <span className="h-10 w-28 bg-white/10 rounded-lg animate-pulse inline-block" />
                )}
                {plan.period && <span className="text-sm text-zinc-500">{plan.period}</span>}
              </div>

              {plan.promoTag && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider w-max">
                  {plan.promoTag}
                </div>
              )}

              <p className="mt-3 text-sm text-zinc-400 leading-relaxed min-h-[48px]">{plan.description}</p>
              <div className="my-6 h-px w-full bg-white/[0.06]" />

              <ul className="space-y-3 text-sm flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <BadgeCheck size={12} />
                    </span>
                    <span className="text-zinc-400">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={hasSession ? `/checkout?plan=${plan.slug}` : `/create-account?plan=${plan.slug}`}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all hover:opacity-90"
                style={
                  plan.featured
                    ? { background: 'white', color: 'black' }
                    : { border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgb(212,212,216)' }
                }
              >
                {hasSession ? t('proceed_to_checkout', 'Proceed to Checkout') : t('land_plans_get_started', 'Get started')} <ChevronRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 mx-auto max-w-3xl rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-center text-sm text-zinc-300 relative z-10 flex items-center justify-center gap-3">
          <ShieldCheck className="shrink-0 text-blue-400" size={20} />
          <span>
            <strong>Hardware Policy:</strong> GPS Hardware devices are not client property — they remain the exclusive company property of <strong>eMoto Fleet OS</strong> and are provided for fleet management. <strong>0 RWF Device Setup Fee.</strong>
          </span>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <h2 className="text-3xl md:text-[40px] font-extrabold tracking-tight leading-tight">
            {t('land_faq_title', 'Frequently Asked Questions')}
          </h2>
          <p className="text-base text-zinc-400">
            {t('land_faq_desc', "Can't find what you're looking for? Reach out to our support team.")}
          </p>
        </div>

        <div className="border-t border-white/[0.08]">
          {localizedFaqItems.map((faq) => (
            <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] px-8 py-16 md:px-16 text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/[0.06] blur-[120px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center gap-6">
            <h2 className="text-3xl md:text-[40px] font-extrabold tracking-tight leading-tight max-w-2xl">
              {t('land_banner_title', "Unlock Your Fleet's Potential with eMoto Fleet OS")}
            </h2>
            <p className="text-base text-zinc-400 max-w-xl">
              {t('land_banner_desc', 'Say goodbye to operational blind spots — Fleet OS handles it all. Deploy, monitor, and protect your riders with confidence.')}
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {hasSession ? (
                <Link href="/overview" className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition" style={{background:'white',color:'black'}}>
                  {t('land_banner_open', 'Open Dashboard')} <ArrowRight size={15} />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition" style={{background:'white',color:'black'}}>
                    {t('land_banner_start', 'Get Started')} <ArrowRight size={15} />
                  </Link>
                  <Link href="/create-account" className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-6 py-3 text-sm font-medium transition hover:bg-white/[0.08]" style={{color:'rgb(212,212,216)'}}>
                    {t('land_banner_create', 'Create Account')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto w-full max-w-7xl px-6 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 group">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-blue-600 text-ink shadow-md shadow-accent/15">
                  <Command size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">
                    E-Moto
                  </p>
                  <p className="font-display text-xs font-bold text-white">Fleet OS</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-500 max-w-[200px]">
                {t('land_footer_desc', 'Smart mobility command center for electric motorcycle fleets.')}
              </p>
            </div>

            {/* Link columns */}
            {Object.entries(localizedFooterLinks).map(([title, links]) => (
              <div key={title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">{title}</p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('/') ? (
                        <Link href={link.href} className="text-sm text-zinc-400 hover:text-white transition">
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-zinc-400 hover:text-white transition">
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
             <p className="text-xs text-zinc-600">&copy; 2026 eMoto Safety &amp; Fleet OS. {t('land_footer_rights', 'All rights reserved.')}</p>
            <div className="flex gap-4">
              <a href="#" className="text-zinc-600 hover:text-white transition" aria-label="Twitter">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" className="text-zinc-600 hover:text-white transition" aria-label="GitHub">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>
              <a href="#" className="text-zinc-600 hover:text-white transition" aria-label="Instagram">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051c-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

