'use client';

import { useState, FormEvent } from 'react';
import { InfoPageLayout } from '@/components/layout/info-page-layout';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslation } from '@/components/i18n/LanguageProvider';

export default function ContactClient() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/auth/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, category, message }),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit inquiry. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InfoPageLayout>
      {/* Hero Section */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="absolute top-0 left-1/3 w-[450px] h-[300px] bg-accent/[0.04] blur-[110px] rounded-full pointer-events-none" />
        
        <span className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400">
          <HelpCircle size={12} className="text-accent" />
          {t('info_contact_badge', '24/7 Operator Support')}
        </span>

        <h1 className="relative z-10 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mt-4">
          {t('info_contact_title', 'Get in Touch with Our Fleet Team')}
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base text-zinc-400">
          {t('info_contact_subtitle', 'Have questions about onboarding your fleet, partner insurance integrations, or customized enterprise deployments? We are here to help.')}
        </p>
      </section>

      {/* Grid: Form + Address Info */}
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-12 lg:grid-cols-12 items-stretch">
          {/* Form Container */}
          <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-white/[0.01] p-6 md:p-8 flex flex-col justify-center min-h-[400px]">
            {submitted ? (
              <div className="text-center py-10 space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
                  <CheckCircle size={36} />
                </div>
                <h3 className="text-xl font-bold text-white">Inquiry Submitted Successfully</h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  Thank you for reaching out, {name}. Our fleet coordinator will review your parameters and follow up within 24 hours.
                </p>
                <button
                  onClick={() => {
                    setName('');
                    setEmail('');
                    setMessage('');
                    setSubmitted(false);
                  }}
                  className="mt-6 rounded-lg border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08]"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jean Damascene"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-white text-xs md:text-sm focus:border-accent outline-none placeholder-zinc-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. jean@company.rw"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-white text-xs md:text-sm focus:border-accent outline-none placeholder-zinc-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400">Topic of Discussion</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-white text-xs md:text-sm focus:border-accent outline-none"
                  >
                    <option value="general">General Operations / Demo Account</option>
                    <option value="api">Developer API Access &amp; MQTT Settings</option>
                    <option value="insurer">Insurance Integration &amp; Telemetry Audits</option>
                    <option value="compliance">Municipal Compliance &amp; Geofences</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400">Your Message</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details about your fleet setup (active bikes, tracker models, etc.)..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-white text-xs md:text-sm focus:border-accent outline-none placeholder-zinc-700 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-xs md:text-sm py-3 transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                  style={{ background: 'white', color: 'black' }}
                >
                  {loading ? 'Sending...' : (
                    <>
                      <Send size={14} /> Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Contact Details Column */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-left">
            <div className="space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Contact Channels</h3>
              
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Rwanda Office</h4>
                    <p className="text-xs text-zinc-500 mt-1">E-Moto Mobility Hub, KN 78 St, Kiyovu, Kigali, Rwanda</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                    <Mail size={18} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Email Address</h4>
                    <p className="text-xs text-zinc-500 mt-1">bruno@emotofleet.com</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                    <Phone size={18} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Telephone Support</h4>
                    <p className="text-xs text-zinc-500 mt-1">+250 798 600 430</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/[0.06] text-xs text-zinc-600 leading-relaxed">
              Our Kiyovu support lab is open Monday through Friday, 8:00 AM to 5:00 PM CAT. Emergency dispatch and crash services remain active 24/7.
            </div>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
