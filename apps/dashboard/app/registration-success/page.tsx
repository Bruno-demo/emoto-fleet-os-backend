'use client';

import { CheckCircle2, Phone, ArrowLeft, MessageSquare, CreditCard, Shield, Handshake } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthPanelHeader, AuthShell } from '@/components/auth/auth-ui';
import { useTranslation } from '@/components/i18n/LanguageProvider';

function RegistrationSuccessContent() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const accountType = params.get('type'); // 'insurance' or null (fleet)
  const isInsurance = accountType === 'insurance';
  const fleetName = params.get('fleet');
  const fleetSize = params.get('size');

  return (
    <AuthShell
      eyebrow={t('success', 'Success')}
      title={
        isInsurance
          ? t('thank_you_partnering', 'Thank you for your interest in partnering with us.')
          : t('welcome_emoto_family', 'Welcome to the E-Moto Fleet family.')
      }
      subtitle={
        isInsurance
          ? t('insurance_partner_created_desc', 'Your insurance partner account has been created. Our team will reach out shortly to discuss subscription fees and onboarding.')
          : t('fleet_account_created_desc', "Your account has been securely created. We're now preparing your fleet environment for live operations.")
      }
      securityHint={isInsurance ? t('payment_pending', 'Payment pending') : t('hardware_setup_in_progress', 'Hardware setup in progress')}
      features={
        isInsurance
          ? [
              {
                icon: <CheckCircle2 size={16} />,
                title: t('account_created', 'Account Created'),
                description: t('insurance_partner_profile_registered', 'Your insurance partner profile is now registered in our system.'),
              },
              {
                icon: <Handshake size={16} />,
                title: t('partnership_review', 'Partnership Review'),
                description: t('partnerships_team_contact', 'Our partnerships team will contact you to discuss monthly fees and coverage terms.'),
              },
              {
                icon: <CreditCard size={16} />,
                title: t('pending_payment', 'Pending Payment'),
                description: t('login_after_subscription_confirmed', 'You will be able to log in once your subscription payment is confirmed.'),
              },
            ]
          : [
              {
                icon: <CheckCircle2 size={16} />,
                title: t('account_secured', 'Account Secured'),
                description: t('credentials_active_database', 'Your login credentials and fleet profile are now active in our database.'),
              },
              {
                icon: <Phone size={16} />,
                title: t('priority_contact', 'Priority Contact'),
                description: t('tech_team_notified_schedule', 'Our technical team has been notified to schedule your bike setup.'),
              },
              {
                icon: <MessageSquare size={16} />,
                title: t('live_support', 'Live Support'),
                description: t('access_onboarding_assistance', 'Access dedicated onboarding assistance as your hardware arrives.'),
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
            eyebrow={isInsurance ? t('partnership_registered', 'Partnership Registered') : t('registration_complete', 'Registration Complete')}
            title={
              isInsurance
                ? t('next_partnership_discussions', 'Next: Partnership Discussions')
                : t('next_hardware_setup', 'Next: Hardware Setup')
            }
            description={
              isInsurance
                ? t('insurance_thank_you_long', 'Thank you for your interest in partnering with us. Our team will contact you shortly to discuss monthly subscription fees and complete your onboarding.')
                : t('fleet_hardware_long', 'Our team will contact you ASAP to install the IoT device on your bike and link it to your dashboard. You will be able to log in once the hardware installation is complete.')
            }
          />
        </div>

        {!isInsurance && (
          <div className="mt-6 w-full rounded-[20px] border border-amber-500/30 bg-amber-500/[0.08] p-5 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Official Payment Channel</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] text-amber-300 font-bold border border-amber-500/30">MTN MoMo</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3">
                <p className="text-[10px] font-bold uppercase text-zinc-400">MoMo Merchant USSD Code</p>
                <p className="font-mono text-sm font-extrabold text-amber-400 mt-1 select-all">*182*8*1*1347154#</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3">
                <p className="text-[10px] font-bold uppercase text-zinc-400">Merchant Account Name</p>
                <p className="font-sans text-sm font-extrabold text-white mt-1">BRUNO</p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400">Use this USSD code on MTN to pay weekly software invoices or activation fees.</p>
          </div>
        )}

        {!isInsurance && fleetName && (
          <div className="mt-4 w-full rounded-[20px] border border-line bg-surface-muted/50 p-5 text-left flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">{t('registered_fleet', 'Registered Fleet')}</p>
              <p className="text-sm font-bold text-ink mt-1.5">{fleetName}</p>
            </div>
            {fleetSize && (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">{t('fleet_size', 'Fleet Size')}</p>
                <span className="inline-flex items-center rounded-lg border border-accent bg-accent/[0.08] px-2.5 py-1 text-xs font-bold text-accent mt-1">
                  {fleetSize}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 w-full rounded-[20px] border border-line bg-surface-muted p-5 text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">
            {isInsurance ? t('want_to_get_started_faster', 'Want to get started faster?') : t('need_faster_setup', 'Need faster setup?')}
          </p>
          <div className="mt-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">+250 798 600 430</p>
              <p className="text-xs text-ink-muted text-nowrap">
                {isInsurance ? t('call_whatsapp_partnerships', 'Call or WhatsApp our Partnerships Team') : t('call_whatsapp_ops', 'Call or WhatsApp our Ops Lead')}
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-accent"
        >
          <ArrowLeft size={16} />
          {t('return_to_home', 'Return to Home')}
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
