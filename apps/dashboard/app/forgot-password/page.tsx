'use client';

import { HelpCircle, Lock, Mail, ShieldCheck, Activity, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { useTranslation } from '@/components/i18n/LanguageProvider';

const resetEndpoint = process.env.NEXT_PUBLIC_PASSWORD_RESET_ENDPOINT || '/auth/forgot-password';

// Provides a lightweight password reset landing page for fleets using admin-managed resets.
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
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
      setNotice(t('reset_not_configured', 'Password reset is not configured yet. Contact your fleet admin for access.'));
      return;
    }

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier.includes('@') && trimmedIdentifier.length > 0 && !/^07\d{8}$/.test(trimmedIdentifier)) {
      setNoticeTone('error');
      setNotice(t('phone_error'));
      return;
    }

    const normalizedIdentifier = /^07\d{8}$/.test(trimmedIdentifier)
      ? '+250' + trimmedIdentifier.slice(1)
      : trimmedIdentifier;

    try {
      setIsSubmitting(true);
      const response = await apiFetch<{ token?: string }>(
        resetEndpoint,
        {
          method: 'POST',
          body: JSON.stringify({ identifier: normalizedIdentifier }),
        },
        { auth: false },
      );
      setNoticeTone('success');
      setNotice(t('recovery_request_sent', 'Request sent. Check your email or phone for next steps. Redirecting to reset page...'));
      if (response && response.token) {
        setGeneratedToken(response.token);
      } else {
        setTimeout(() => {
          router.push(`/reset-password?identifier=${encodeURIComponent(normalizedIdentifier)}`);
        }, 2000);
      }
      setIdentifier('');
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError) {
        setNoticeTone('error');
        setNotice(requestError.message);
      } else {
        setNoticeTone('error');
        setNotice(t('recovery_failed', 'Unable to request a reset right now'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t('recovery_title')}
      title={t('reset_requests_handled', 'Reset requests are handled by your fleet admin.')}
      subtitle={t('recovery_subtitle')}
      securityHint={t('data_secure')}
      features={[
        {
          icon: <Lock size={16} />,
          title: t('verified_recovery'),
          description: t('verified_recovery_desc'),
        },
        {
          icon: <HelpCircle size={16} />,
          title: t('fast_support'),
          description: t('fast_support_desc'),
        },
        {
          icon: <Mail size={16} />,
          title: t('secure_follow_up'),
          description: t('secure_follow_up_desc'),
        },
        {
          icon: <ShieldCheck size={16} />,
          title: t('access_control', 'Access control'),
          description: t('access_control_desc', 'Strict security audits protect operations and rider accounts.'),
        },
        {
          icon: <Activity size={16} />,
          title: t('live_reporting', 'Live reporting'),
          description: t('live_reporting_desc', 'Track operations activity live and review security audit logs.'),
        },
        {
          icon: <UserPlus size={16} />,
          title: t('team_management', 'Team management'),
          description: t('team_management_desc', 'Reinstate logins, modify permissions, or delete accounts securely.'),
        },
      ]}
    >
      <AuthPanelHeader
        eyebrow={t('forgot_title')}
        title={t('forgot_request')}
        description={t('forgot_desc')}
      />
      <AuthTabs active="login" />

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <AuthInput
          label={t('email_or_phone')}
          placeholder={t('email_or_phone_placeholder', 'name@fleet.example or 07...')}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          icon={<Mail size={16} />}
        />
        {notice ? <AuthNotice message={notice} tone={noticeTone} /> : null}
        <AuthButton
          type="submit"
          label={isSubmitting ? t('requesting_support') : t('request_support')}
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
              style={{ background: '#3B82F6', color: 'white' }}
            >
              Proceed to Reset Password
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-ink-muted">
          {t('remembered_password_prompt', 'Remembered your password?')}{' '}
          <Link href="/login" className="font-semibold text-ink">
            {t('return_login')}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

