'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bike,
  ChevronLeft,
  ShieldCheck,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { ApiError, apiFetch } from '@/lib/api/client';
import { subscriptionCheckoutResponseSchema } from '@/lib/api/schemas';
interface PricingTier {
  id: string;
  name: string;
  planCode: string;
  monthlyRatePerBike: number;
  setupFeePerBike: number;
  description: string | null;
  isActive: boolean;
}

interface PromoDiscount {
  id: string;
  name: string;
  code: string | null;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  appliesTo: 'SETUP_FEE' | 'SUBSCRIPTION' | 'BOTH';
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  fleetId: string | null;
  isActive: boolean;
}

const PLAN_DETAILS: Record<
  string,
  { title: string; price: string; period: string; features: string[] }
> = {
  'safety-core': {
    title: 'Safety Core',
    price: '5,000 RWF',
    period: '/ bike / mo',
    features: [
      'Live map + alerts',
      'Incident workflows',
      'Rider scores',
      'Remote command controls',
      'Email support',
      '+ 35,000 RWF device setup & install fee',
    ],
  },
  'operations-plus': {
    title: 'Operations Plus',
    price: '10,000 RWF',
    period: '/ bike / mo',
    features: [
      'Everything in Core',
      'Financial management control',
      'Trip analytics',
      'Compliance reports',
      'Priority support',
      '+ 35,000 RWF device setup & install fee',
    ],
  },
  enterprise: {
    title: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Everything in Plus',
      'Partner API',
      'Dedicated support',
      'Enterprise SLA',
      'Custom integrations',
    ],
  },
};

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutContent />
    </RequireAuth>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const planSlug = searchParams.get('plan');
  const plan = planSlug ? PLAN_DETAILS[planSlug] : null;
  const [confirmed, setConfirmed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const isOperationsPlus = planSlug === 'operations-plus';

  // Dynamic pricing & promo codes
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<PromoDiscount | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const { data: pricingTiers } = useQuery<PricingTier[]>({
    queryKey: ['billing', 'pricing-tiers'],
    queryFn: () => apiFetch<PricingTier[]>('/billing/pricing'),
  });

  const demoTier = pricingTiers?.find(t => t.planCode === 'DEMO');
  const premiumTier = pricingTiers?.find(t => t.planCode === 'PREMIUM');

  const displayPrice = isOperationsPlus
    ? (premiumTier ? `${premiumTier.monthlyRatePerBike.toLocaleString()} RWF` : '10,000 RWF')
    : (demoTier ? `${demoTier.monthlyRatePerBike.toLocaleString()} RWF` : '5,000 RWF');

  const activeTier = isOperationsPlus ? premiumTier : demoTier;
  const { data: bikesData } = useQuery({
    queryKey: ['bikes', 'list', { page: 1, pageSize: 1 }],
    queryFn: () => apiFetch<{ total: number }>('/bikes?page=1&pageSize=1'),
  });
  const bikeCount = bikesData?.total ?? 0;

  const displayFeatures = plan?.features
    .filter(f => !f.includes('setup & install fee'))
    .map(f => f) ?? [];

  useEffect(() => {
    if (!showSuccess) return;
    if (countdown <= 0) {
      router.push('/live');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showSuccess, countdown, router]);

  const checkoutMutation = useMutation({
    mutationFn: () =>
      apiFetch(
        '/subscription/checkout',
        {
          method: 'POST',
          body: JSON.stringify({ plan: 'PREMIUM' }),
        },
        { schema: subscriptionCheckoutResponseSchema },
      ),
    onSuccess: async () => {
      setConfirmed(true);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setShowSuccess(true);
    },
    onError: (requestError: unknown) => {
      setConfirmed(false);
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to confirm the subscription right now',
      );
    },
  });

  const handleValidatePromo = async () => {
    setPromoError(null);
    setAppliedDiscount(null);
    if (!promoCode.trim()) return;

    try {
      setIsValidatingPromo(true);
      const originalAmount = isOperationsPlus
        ? (premiumTier?.monthlyRatePerBike ?? 10000)
        : (demoTier?.monthlyRatePerBike ?? 5000);
      const res = await apiFetch<{ discount: PromoDiscount }>('/billing/validate-discount', {
        method: 'POST',
        body: JSON.stringify({
          code: promoCode,
          originalAmount,
          target: 'subscription',
        }),
      });
      setAppliedDiscount(res.discount);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPromoError(err.message);
      } else {
        setPromoError('Invalid code');
      }
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleConfirm = () => {
    setError(null);
    setConfirmed(false);

    if (!isOperationsPlus) {
      setError('Only Operations Plus checkout is available in the dashboard right now.');
      return;
    }

    checkoutMutation.mutate();
  };

  if (showSuccess) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-ink px-6">
        <div className="w-full max-w-lg rounded-3xl border border-white/[0.06] bg-[var(--background-subtle)] p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 border border-accent/30 text-accent">
            <ShieldCheck size={32} />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
              Subscription Pending
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">
              Upgrade Request Received!
            </h2>
          </div>

          <div className="p-4 rounded-2xl bg-black/30 border border-white/[0.04] space-y-3">
            <p className="text-sm text-ink-soft leading-relaxed">
              Your request to upgrade to <strong className="text-accent font-bold">Operations Plus</strong> is currently pending.
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              Please wait for your payment to be approved by the HQ admin. You will be kept on the <strong className="text-white font-semibold">Safety Core</strong> plan until the HQ admin confirms your upgrade payment.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <Link
              href="/live"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold text-white hover:scale-[1.02] transition-all"
              style={{ background: '#3B82F6', color: 'white' }}
            >
              Launch Safety Core Dashboard <ArrowRight size={14} />
            </Link>
            
            <p className="text-xs text-ink-muted">
              Redirecting automatically in <span className="font-bold text-accent">{countdown}s</span>...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-ink">
        <div className="text-center space-y-4">
          <p className="text-lg font-bold">No plan selected</p>
          <p className="text-sm text-ink-muted">
            Return to pricing to choose a plan.
          </p>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white hover:scale-105 transition-transform"
            style={{ background: '#3B82F6', color: 'white' }}
          >
            View plans <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      {/* Header */}
      <header className="border-b border-line/50 bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 border border-accent/30 text-accent transition group-hover:bg-accent/30">
              <Bike size={18} />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted">
                eMoto
              </p>
              <p className="text-sm font-bold">Fleet OS</p>
            </div>
          </Link>
          <Link
            href="/live"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition"
          >
            <ChevronLeft size={14} /> Back to dashboard
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
            Checkout
          </p>
          <h1 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">
            Confirm your plan
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Review your selected plan and confirm your payment method.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-6">
            {/* Plan summary */}
            <div className="rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-6 space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
                  {plan.title}
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-ink">
                    {displayPrice}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-ink-muted">{plan.period}</span>
                  )}
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-line to-transparent" />

              <ul className="space-y-3 text-sm">
                {displayFeatures.map((feat) => (
                  <li key={feat} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                      <BadgeCheck size={12} />
                    </span>
                    <span className="text-ink-soft">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Calculation Card */}
            <div className="rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">
                Estimated Monthly Charge
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Active fleet size</span>
                  <span className="font-bold text-ink">
                    {bikeCount} {bikeCount === 1 ? 'bike' : 'bikes'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Monthly rate per bike</span>
                  <span className="font-bold text-ink">
                    {(activeTier?.monthlyRatePerBike ?? 10000).toLocaleString()} RWF
                  </span>
                </div>
                <div className="h-px w-full bg-line/50 my-1" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-ink">Total Monthly Payment</span>
                  <span className="text-xl font-extrabold text-accent">
                    {(bikeCount * (activeTier?.monthlyRatePerBike ?? 10000)).toLocaleString()} RWF
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">
                Payment method
              </p>

              {/* Pay on Request */}
              <label className="flex items-start gap-4 rounded-xl border-2 border-accent bg-accent/[0.07] p-4 cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  value="pay-on-request"
                  checked
                  readOnly
                  className="mt-2.5 accent-[var(--color-accent)]"
                />
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 border border-accent/30 text-accent">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-bike" aria-hidden="true">
                    <circle cx="18.5" cy="17.5" r="3.5"></circle>
                    <circle cx="5.5" cy="17.5" r="3.5"></circle>
                    <circle cx="15" cy="5" r="1"></circle>
                    <path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-ink block">
                    Pay on Request
                  </span>
                  <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                    Pay once our team requests you to pay.
                  </p>
                </div>
              </label>

              {/* More payment methods coming soon */}
              <div className="rounded-xl border border-line/50 bg-black/20 p-4 opacity-50">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-ink-muted" />
                  <span className="text-xs font-semibold text-ink-muted">
                    More payment methods coming soon
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Mobile money, card payments, and invoicing will be available
                  shortly.
                </p>
              </div>
            </div>

            {/* Promo Code Card */}
            <div className="rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-6 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">
                Have a promo code?
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code..."
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  disabled={isValidatingPromo}
                  className="h-9 flex-1 bg-background border border-line rounded-xl px-3 text-xs text-white placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleValidatePromo}
                  disabled={!promoCode.trim() || isValidatingPromo}
                  className="px-4 rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
                >
                  {isValidatingPromo ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {appliedDiscount ? (
                <p className="text-xs text-success-ink font-semibold flex items-center gap-1.5">
                  <Check size={12} /> {`Discount "${String(appliedDiscount.name)}" applied successfully!`}
                </p>
              ) : promoError ? (
                <p className="text-xs text-danger-ink font-semibold">
                  {promoError}
                </p>
              ) : null}
            </div>

            {/* Confirm */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={checkoutMutation.isPending || confirmed}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: '#3B82F6', color: 'white' }}
            >
              {confirmed ? (
                <>
                  <BadgeCheck size={16} /> Confirmed - Redirecting...
                </>
              ) : checkoutMutation.isPending ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  Confirm & Launch Dashboard <ArrowRight size={14} />
                </>
              )}
            </button>

            {error ? (
              <p className="rounded-xl border border-danger-ink/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-ink">
                {error}
              </p>
            ) : null}

            <p className="text-center text-[11px] text-ink-muted leading-relaxed">
              By confirming, you agree to the{' '}
              <Link href="/terms" className="underline hover:text-ink transition">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-ink transition">
                Privacy Policy
              </Link>
              . Payments will be handled on request.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
