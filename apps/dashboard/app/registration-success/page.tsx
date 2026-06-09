'use client';

import { CheckCircle2, Phone, ArrowLeft, MessageSquare, CreditCard, Shield, Handshake } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthPanelHeader, AuthShell } from '@/components/auth/auth-ui';

function RegistrationSuccessContent() {
  const params = useSearchParams();
  const accountType = params.get('type'); // 'insurance' or null (fleet)
  const isInsurance = accountType === 'insurance';

  return (
    <AuthShell
      eyebrow="Success"
      title={
        isInsurance
          ? 'Thank you for your interest in partnering with us.'
          : 'Welcome to the E-Moto Fleet family.'
      }
      subtitle={
        isInsurance
          ? 'Your insurance partner account has been created. Our team will reach out shortly to discuss subscription fees and onboarding.'
          : "Your account has been securely created. We're now preparing your fleet environment for live operations."
      }
      securityHint={isInsurance ? 'Payment pending' : 'Hardware setup in progress'}
      features={
        isInsurance
          ? [
              {
                icon: <CheckCircle2 size={16} />,
                title: 'Account Created',
                description: 'Your insurance partner profile is now registered in our system.',
              },
              {
                icon: <Handshake size={16} />,
                title: 'Partnership Review',
                description: 'Our partnerships team will contact you to discuss monthly fees and coverage terms.',
              },
              {
                icon: <CreditCard size={16} />,
                title: 'Pending Payment',
                description: 'You will be able to log in once your subscription payment is confirmed.',
              },
            ]
          : [
              {
                icon: <CheckCircle2 size={16} />,
                title: 'Account Secured',
                description: 'Your login credentials and fleet profile are now active in our database.',
              },
              {
                icon: <Phone size={16} />,
                title: 'Priority Contact',
                description: 'Our technical team has been notified to schedule your bike setup.',
              },
              {
                icon: <MessageSquare size={16} />,
                title: 'Live Support',
                description: 'Access dedicated onboarding assistance as your hardware arrives.',
              },
            ]
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-[24px] shadow-[0_0_40px_rgba(16,185,129,0.2)] ${
          isInsurance
            ? 'bg-accent/10 text-accent'
            : 'bg-success-soft text-success-ink'
        }`}>
          {isInsurance ? <Shield size={40} /> : <CheckCircle2 size={40} />}
        </div>

        <div className="mt-8">
          <AuthPanelHeader
            eyebrow="Registration Complete"
            title={
              isInsurance
                ? 'Next: Subscription Setup'
                : 'Next: Hardware Setup'
            }
            description={
              isInsurance
                ? 'Our partnerships team will contact you shortly to discuss monthly subscription fees and complete your onboarding. You will be able to log in once your payment is confirmed.'
                : 'Our team will contact you ASAP to install the IoT device on your bike and link it to your dashboard. You will be able to log in once the hardware installation is complete.'
            }
          />
        </div>

        <div className="mt-8 w-full rounded-[20px] border border-line bg-surface-muted p-5 text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">
            {isInsurance ? 'Want to get started faster?' : 'Need faster setup?'}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">+250 798 600 430</p>
              <p className="text-xs text-ink-muted text-nowrap">
                {isInsurance ? 'Call or WhatsApp our Partnerships Team' : 'Call or WhatsApp our Ops Lead'}
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-accent"
        >
          <ArrowLeft size={16} />
          Return to Home
        </Link>
      </div>
    </AuthShell>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><p className="text-sm text-ink-soft">Loading...</p></div>}>
      <RegistrationSuccessContent />
    </Suspense>
  );
}
