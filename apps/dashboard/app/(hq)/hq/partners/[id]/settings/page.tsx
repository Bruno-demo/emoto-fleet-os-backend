'use client';

import { useParams, useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Settings, Zap, Globe, Lock, Key, Webhook, Plus, Trash2, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { useState } from 'react';

const partnerDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.string(),
  clients: z.array(z.object({
    id: z.string(),
    clientId: z.string(),
    scopes: z.string(),
    status: z.string(),
    createdAt: z.string(),
  })),
  webhooks: z.array(z.object({
    id: z.string(),
    url: z.string(),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
  _count: z.object({
    clients: z.number(),
    webhooks: z.number(),
    fleetAccesses: z.number(),
  }),
});

export default function PartnerSettingsPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newClientId, setNewClientId] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [showNewCredentialForm, setShowNewCredentialForm] = useState(false);
  const [showNewWebhookForm, setShowNewWebhookForm] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<{ clientId: string; secret: string } | null>(null);

  const { data: partner, isLoading } = useQuery({
    queryKey: ['hq', 'partner', id],
    queryFn: () => apiFetch(`/hq/partners/${id}`, {}, { schema: partnerDetailSchema }),
    enabled: !!id,
  });

  const createCredentialMutation = useMutation({
    mutationFn: (data: { clientId: string; scopes: string }) =>
      apiFetch(`/hq/partners/${id}/credentials`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data: unknown) => {
      const result = data as { clientId: string; clientSecret: string };
      queryClient.invalidateQueries({ queryKey: ['hq', 'partner', id] });
      setCreatedSecret({ clientId: result.clientId, secret: result.clientSecret });
      setNewClientId('');
      setShowNewCredentialForm(false);
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: (credentialId: string) =>
      apiFetch(`/hq/partners/${id}/credentials/${credentialId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'partner', id] });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { url: string }) =>
      apiFetch(`/hq/partners/${id}/webhooks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'partner', id] });
      setNewWebhookUrl('');
      setShowNewWebhookForm(false);
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (webhookId: string) =>
      apiFetch(`/hq/webhooks/${webhookId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'partner', id] });
    },
  });

  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-white">Partner not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">{partner.name} Settings</h1>
          <p className="mt-1 text-zinc-400">Manage API credentials and webhook integrations</p>
        </div>
      </div>

      {/* Credentials Section */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Key size={18} className="text-zinc-400" />
            API Credentials
          </h2>
          <button
            onClick={() => setShowNewCredentialForm(!showNewCredentialForm)}
            className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-all"
          >
            <Plus size={14} />
            New Credential
          </button>
        </div>

        {/* New Credential Form */}
        {showNewCredentialForm && (
          <div className="mb-6 rounded-xl border border-line bg-white/[0.02] p-4 space-y-4">
            <input
              type="text"
              placeholder="Client ID (e.g., partner_prod_1)"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => createCredentialMutation.mutate({ clientId: newClientId, scopes: 'bikes:read,trips:read,events:read' })}
              disabled={!newClientId || createCredentialMutation.isPending}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-50 transition-all"
            >
              {createCredentialMutation.isPending ? 'Creating...' : 'Create Credential'}
            </button>
          </div>
        )}

        {/* Created Secret Alert */}
        {createdSecret && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-bold text-emerald-300 mb-3">⚠️ Secret Revealed (Save it now, you won&apos;t see it again)</p>
            <div className="space-y-2 font-mono text-xs">
              <div>
                <p className="text-zinc-500">Client ID:</p>
                <p className="text-emerald-300">{createdSecret.clientId}</p>
              </div>
              <div>
                <p className="text-zinc-500">Client Secret:</p>
                <p className="text-emerald-300 break-all">{createdSecret.secret}</p>
              </div>
            </div>
            <button
              onClick={() => setCreatedSecret(null)}
              className="mt-4 text-xs text-emerald-300 hover:text-emerald-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Credentials List */}
        <div className="space-y-3">
          {partner.clients.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Key size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No API credentials created yet</p>
            </div>
          ) : (
            partner.clients.map(client => (
              <div key={client.id} className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all">
                <div className="flex-1">
                  <p className="text-sm font-mono text-white">{client.clientId}</p>
                  <p className="text-xs text-zinc-500 mt-1">Scopes: {client.scopes}</p>
                  <p className="text-xs text-zinc-600 mt-1">Created {new Date(client.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(client.clientId, `client-${client.id}`)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 hover:text-white transition-all"
                  >
                    {copiedId === `client-${client.id}` ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => deleteCredentialMutation.mutate(client.id)}
                    disabled={deleteCredentialMutation.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Webhooks Section */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Webhook size={18} className="text-zinc-400" />
            Webhook Endpoints
          </h2>
          <button
            onClick={() => setShowNewWebhookForm(!showNewWebhookForm)}
            className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-all"
          >
            <Plus size={14} />
            New Webhook
          </button>
        </div>

        {/* New Webhook Form */}
        {showNewWebhookForm && (
          <div className="mb-6 rounded-xl border border-line bg-white/[0.02] p-4 space-y-4">
            <input
              type="url"
              placeholder="Webhook URL (https://...)"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => createWebhookMutation.mutate({ url: newWebhookUrl })}
              disabled={!newWebhookUrl || createWebhookMutation.isPending}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-50 transition-all"
            >
              {createWebhookMutation.isPending ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        )}

        {/* Webhooks List */}
        <div className="space-y-3">
          {partner.webhooks.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Webhook size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No webhook endpoints configured</p>
            </div>
          ) : (
            partner.webhooks.map(webhook => (
              <div key={webhook.id} className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate font-mono">{webhook.url}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {webhook.active ? '✓ Active' : '✗ Inactive'} • Created {new Date(webhook.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => copyToClipboard(webhook.url, `webhook-${webhook.id}`)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 hover:text-white transition-all"
                  >
                    {copiedId === `webhook-${webhook.id}` ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                    disabled={deleteWebhookMutation.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <Link 
          href="/hq/partners"
          className="text-sm font-medium text-zinc-500 hover:text-white transition-colors"
        >
          Return to Partner Registry
        </Link>
      </div>
    </div>
  );
}
