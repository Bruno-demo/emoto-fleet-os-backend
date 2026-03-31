'use client';

import { HelpCircle, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  AuthButton,
  AuthInput,
  AuthNotice,
  AuthPanelHeader,
  AuthShell,
  AuthTabs,
} from '@/components/auth/auth-ui';
import { ApiError, apiFetch } from '@/lib/api/client';

const resetEndpoint = process.env.NEXT_PUBLIC_PASSWORD_RESET_ENDPOINT ?? '';

// Provides a lightweight password reset landing page for fleets using admin-managed resets.
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'warning' | 'success' | 'error'>('warning');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Requests a password reset when an endpoint is configured.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    if (!resetEndpoint) {
      setNoticeTone('warning');
      setNotice('Password reset is not configured yet. Contact your fleet admin for access.');
      return;
    }

    try {
      setIsSubmitting(true);
      await apiFetch(
        resetEndpoint,
        {
          method: 'POST',
          body: JSON.stringify({ identifier: identifier.trim() }),
        },
        { auth: false },
      );
      setNoticeTone('success');
      setNotice('Request sent. Check your email or phone for next steps.');
      setIdentifier('');
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError) {
        setNoticeTone('error');
        setNotice(requestError.message);
      } else {
        setNoticeTone('error');
        setNotice('Unable to request a reset right now');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <AuthInput
          label="Email or phone"
          placeholder="name@fleet.example or +2507..."
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          icon={<Mail size={16} />}
        />
        {notice ? <AuthNotice message={notice} tone={noticeTone} /> : null}
        <AuthButton
          type="submit"
          label={isSubmitting ? 'Requesting support...' : 'Request reset support'}
          isLoading={isSubmitting}
          disabled={identifier.trim().length < 3 || isSubmitting}
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
