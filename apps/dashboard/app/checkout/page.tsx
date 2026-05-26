'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bike,
  ChevronLeft,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { ApiError, apiFetch } from '@/lib/api/client';
import { subscriptionCheckoutResponseSchema } from '@/lib/api/schemas';
import type { SessionUser } from '@/lib/types/dashboard';

const PLAN_DETAILS: Record<
  string,
  { title: string; price: string; period: string; features: string[] }
> = {
  'safety-core': {
    title: 'Safety Core',
    price: '10,000 RWF',
    period: '/ bike / mo',
    features: [
      'Live map + alerts',
      'Incident workflows',
      'Rider scores',
      'Email support',
      '+ 50,000 RWF device setup & install fee',
    ],
  },
  'operations-plus': {
    title: 'Operations Plus',
    price: '25,000 RWF',
    period: '/ bike / mo',
    features: [
      'Everything in Core',
      'Command controls',
      'Trip analytics',
      'Compliance reports',
      'Priority support',
      '+ 50,000 RWF device setup & install fee',
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
  const [error, setError] = useState<string | null>(null);
  const isOperationsPlus = planSlug === 'operations-plus';

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
    onSuccess: async (result) => {
      setConfirmed(true);
      queryClient.setQueryData<SessionUser | undefined>(
        ['auth', 'me'],
        (currentUser) =>
          currentUser
            ? {
                ...currentUser,
                fleetPlan: result.fleetPlan,
                subscriptionStatus: result.subscriptionStatus,
              }
            : currentUser,
      );
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      window.setTimeout(() => router.push('/live'), 800);
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

  const handleConfirm = () => {
    setError(null);
    setConfirmed(false);

    if (!isOperationsPlus) {
      setError('Only Operations Plus checkout is available in the dashboard right now.');
      return;
    }

    checkoutMutation.mutate();
  };

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
            href="/#pricing"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition"
          >
            <ChevronLeft size={14} /> Back to pricing
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
          {/* Plan summary */}
          <div className="rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-6 space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
                {plan.title}
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-ink">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-ink-muted">{plan.period}</span>
                )}
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-line to-transparent" />

            <ul className="space-y-3 text-sm">
              {plan.features.map((feat) => (
                <li key={feat} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <BadgeCheck size={12} />
                  </span>
                  <span className="text-ink-soft">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment method */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.06] bg-[var(--background-subtle)] p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">
                Payment method
              </p>

              {/* Cash on Install - only option for now */}
              <label className="flex items-start gap-4 rounded-xl border-2 border-accent bg-accent/[0.07] p-4 cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  value="cash-on-install"
                  checked
                  readOnly
                  className="mt-0.5 accent-[var(--color-accent)]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Banknote size={16} className="text-accent" />
                    <span className="text-sm font-bold text-ink">
                      Cash on Install
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
                    Pay when our team arrives to set up your fleet devices. No
                    upfront charge required.
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
              <a href="#" className="underline hover:text-ink transition">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="underline hover:text-ink transition">
                Privacy Policy
              </a>
              . No charge until installation is complete.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

