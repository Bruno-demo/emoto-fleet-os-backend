'use client';

import { HelpCircle, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  AuthButton,
  AuthInput,
  AuthPanelHeader,
  AuthShell,
  AuthTabs,
} from '@/components/auth/auth-ui';

// Provides a lightweight password reset landing page for fleets using admin-managed resets.
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset requests are handled by your fleet admin."
      subtitle="For security reasons, password resets are initiated by your fleet operations team. Submit your email or phone so they can verify your request."
      securityHint="Your data is सुरक्षित / secure"
      features={[
        {
          icon: <Lock size={16} />,
          title: 'Verified recovery',
          description: 'Reset flows require fleet approval before credentials are updated.',
        },
        {
          icon: <HelpCircle size={16} />,
          title: 'Fast support',
          description: 'Operators can restore access quickly via the admin console.',
        },
        {
          icon: <Mail size={16} />,
          title: 'Secure follow-up',
          description: 'Recovery notifications are sent through trusted channels only.',
        },
      ]}
    >
      <AuthPanelHeader
        eyebrow="Forgot password"
        title="Request assistance"
        description="Share the email or phone attached to your account. Your admin will follow up with next steps."
      />
      <AuthTabs active="login" />

      <form className="mt-6 space-y-4">
        <AuthInput
          label="Email or phone"
          placeholder="name@fleet.example or +2507..."
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          icon={<Mail size={16} />}
        />
        <AuthButton
          type="button"
          label="Request reset support"
          disabled={identifier.trim().length < 3}
        />
        <p className="text-center text-xs text-[#0F172A]/60">
          Remembered your password?{' '}
          <Link href="/login" className="font-semibold text-[#0F172A]">
            Return to login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
