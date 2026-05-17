'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Check, Copy, Eye, EyeOff, Key, Plug, Shield } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';

interface CreatedPartner {
  id: string;
  name: string;
  status: string;
}

interface CreatedCredential {
  id: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  createdAt: string;
}

type OnboardStep = 'details' | 'credentials' | 'done';

export default function OnboardPartnerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<OnboardStep>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Partner details
  const [partnerName, setPartnerName] = useState('');

  // Step 2 — Credential setup
  const [clientIdInput, setClientIdInput] = useState('');
  const [scopes, setScopes] = useState('bikes:read trips:read telemetry:read');

  // Results
  const [createdPartner, setCreatedPartner] = useState<CreatedPartner | null>(null);
  const [credential, setCredential] = useState<CreatedCredential | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCreatePartner = async () => {
    if (!partnerName.trim()) {
      setError('Partner name is required');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const partner = await apiFetch<CreatedPartner>('/hq/partners', {
        method: 'POST',
        body: JSON.stringify({ name: partnerName.trim() }),
      });
      setCreatedPartner(partner);
      setClientIdInput(`${partnerName.trim().toLowerCase().replace(/\s+/g, '-')}-client`);
      setStep('credentials');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create partner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCredential = async () => {
    if (!clientIdInput.trim()) {
      setError('Client ID is required');
      return;
    }
    if (!createdPartner) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const cred = await apiFetch<CreatedCredential>(
        `/hq/partners/${createdPartner.id}/credentials`,
        {
          method: 'POST',
          body: JSON.stringify({
            clientId: clientIdInput.trim(),
            scopes: scopes.trim(),
          }),
        },
      );
      setCredential(cred);
      await queryClient.invalidateQueries({ queryKey: ['hq', 'partners'] });
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Partners
        </button>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Onboard New Partner</h1>
        <p className="mt-1 text-zinc-400">Set up a new strategic integration and provision API credentials.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {(['details', 'credentials', 'done'] as OnboardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              step === s ? 'bg-accent text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]' :
              (['details', 'credentials', 'done'].indexOf(step) > i) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              'bg-white/5 text-zinc-500 border border-white/10'
            }`}>
              {(['details', 'credentials', 'done'].indexOf(step) > i) ? <Check size={14} /> : i + 1}
            </div>
            {i < 2 && <div className={`h-0.5 w-12 rounded transition-all ${
              (['details', 'credentials', 'done'].indexOf(step) > i) ? 'bg-emerald-500/40' : 'bg-white/10'
            }`} />}
          </div>
        ))}
        <span className="ml-3 text-xs font-medium text-zinc-500">
          {step === 'details' && 'Partner Details'}
          {step === 'credentials' && 'API Credentials'}
          {step === 'done' && 'Complete'}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>
      )}

      {/* Step 1: Partner Details */}
      {step === 'details' && (
        <div className="rounded-[32px] border border-line bg-surface-strong p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Plug size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Partner Identity</h2>
              <p className="text-sm text-zinc-500">Define the partner organization details.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Organization Name *</label>
            <input
              type="text"
              placeholder="e.g. SafeRide Insurance"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-accent focus:bg-white/[0.08]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => router.back()} className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-white/10 transition">
              Cancel
            </button>
            <button onClick={handleCreatePartner} disabled={isSubmitting} className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:brightness-110 transition disabled:opacity-60">
              {isSubmitting ? 'Creating...' : 'Create Partner'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Credential Setup */}
      {step === 'credentials' && (
        <div className="rounded-[32px] border border-line bg-surface-strong p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Key size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">API Credentials</h2>
              <p className="text-sm text-zinc-500">Generate scoped API access for <span className="text-white font-semibold">{createdPartner?.name}</span>.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Client ID *</label>
            <input
              type="text"
              placeholder="e.g. saferide-prod"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-accent focus:bg-white/[0.08] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Scopes</label>
            <input
              type="text"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-accent focus:bg-white/[0.08] font-mono"
            />
            <p className="mt-1.5 text-[11px] text-zinc-600">Space-separated scope list. Example: bikes:read trips:read telemetry:read</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep('details')} className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-white/10 transition">
              Back
            </button>
            <button onClick={handleCreateCredential} disabled={isSubmitting} className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:brightness-110 transition disabled:opacity-60">
              {isSubmitting ? 'Generating...' : 'Generate Credentials'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && credential && (
        <div className="rounded-[32px] border border-line bg-surface-strong p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Credentials Generated</h2>
              <p className="text-sm text-zinc-500"><span className="text-white font-semibold">{createdPartner?.name}</span> is ready to connect.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">⚠ One-Time Display</p>
            <p className="text-sm text-amber-300/80">The Client Secret below is shown only once. Copy it now and store it securely. It cannot be retrieved later.</p>
          </div>

          <div className="space-y-3">
            <CredentialField label="Client ID" value={credential.clientId} onCopy={() => copyToClipboard(credential.clientId, 'clientId')} copied={copiedField === 'clientId'} />
            <div className="relative">
              <CredentialField
                label="Client Secret"
                value={showSecret ? credential.clientSecret : '•'.repeat(48)}
                onCopy={() => copyToClipboard(credential.clientSecret, 'clientSecret')}
                copied={copiedField === 'clientSecret'}
                mono
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white transition"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <CredentialField label="Scopes" value={credential.scopes} onCopy={() => copyToClipboard(credential.scopes, 'scopes')} copied={copiedField === 'scopes'} />
          </div>

          <button
            onClick={() => router.push('/hq/partners')}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:brightness-110 transition"
          >
            Back to Partner Directory
          </button>
        </div>
      )}
    </div>
  );
}

function CredentialField({ label, value, onCopy, copied, mono }: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.03] px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className={`mt-0.5 text-sm text-white truncate ${mono !== false ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button onClick={onCopy} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition">
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

