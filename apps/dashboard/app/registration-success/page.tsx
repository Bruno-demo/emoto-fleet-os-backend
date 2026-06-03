'use client';

import { CheckCircle2, Phone, ArrowLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { AuthPanelHeader, AuthShell } from '@/components/auth/auth-ui';

export default function RegistrationSuccessPage() {
  return (
    <AuthShell
      eyebrow="Success"
      title="Welcome to the E-Moto Fleet family."
      subtitle="Your account has been securely created. We're now preparing your fleet environment for live operations."
      securityHint="Hardware setup in progress"
      features={[
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
      ]}
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-success-soft text-success-ink shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          <CheckCircle2 size={40} />
        </div>

        <div className="mt-8">
          <AuthPanelHeader
            eyebrow="Registration Complete"
            title="Next: Hardware Setup"
            description="Our team will contact you ASAP to install the IoT device on your bike and link it to your dashboard. You will be able to log in once the hardware installation is complete."
          />
        </div>

        <div className="mt-8 w-full rounded-[20px] border border-line bg-surface-muted p-5 text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">
            Need faster setup?
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">+250 798 600 430</p>
              <p className="text-xs text-ink-muted text-nowrap">Call or WhatsApp our Ops Lead</p>
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

