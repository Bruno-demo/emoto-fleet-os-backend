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

const resetEndpoint = process.env.NEXT_PUBLIC_PASSWORD_RESET_ENDPOINT || '/auth/forgot-password';

// Provides a lightweight password reset landing page for fleets using admin-managed resets.
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'warning' | 'success' | 'error'>('warning');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Requests a password reset when an endpoint is configured.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setGeneratedToken(null);

    if (!resetEndpoint) {
      setNoticeTone('warning');
      setNotice('Password reset is not configured yet. Contact your fleet admin for access.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiFetch<any>(
        resetEndpoint,
        {
          method: 'POST',
          body: JSON.stringify({ identifier: identifier.trim() }),
        },
        { auth: false },
      );
      setNoticeTone('success');
      setNotice('Request sent. Check your email or phone for next steps.');
      if (response && response.token) {
        setGeneratedToken(response.token);
      }
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
        
        {generatedToken && (
          <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4 text-center animate-scale-in">
            <p className="text-xs text-ink-muted mb-2">
              [DEV MODE] Password reset token generated successfully:
            </p>
            <p className="font-mono text-lg font-bold text-accent tracking-wider mb-3">
              {generatedToken}
            </p>
            <Link
              href={`/reset-password?token=${generatedToken}`}
              className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
            >
              Proceed to Reset Password
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-ink-muted">
          Remembered your password?{' '}
          <Link href="/login" className="font-semibold text-ink">
            Return to login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

