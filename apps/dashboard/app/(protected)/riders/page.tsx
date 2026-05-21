'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bike,
  Mail,
  Phone,
  Plus,
  Search,
  Shield,
  UserPlus,
  UserRound,
  Users,
  X,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { Assignment, PaginatedResponse, Rider } from '@/lib/types/dashboard';
import { cx, formatEnumLabel } from '@/lib/ui';

const PAGE_SIZE = 20;

export default function RidersPage() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Create form fields
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');

  // Invite creation state
  const [formMode, setFormMode] = useState<'direct' | 'invite'>('direct');
  const [expiresInHours, setExpiresInHours] = useState('168');
  const [generatedInvite, setGeneratedInvite] = useState<{ inviteId: string; token: string; link: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleGenerateInvite = async () => {
    setInviteError(null);
    setIsGeneratingInvite(true);
    setGeneratedInvite(null);
    try {
      const data = await apiFetch<{ inviteId: string; token: string }>('/auth/invites', {
        method: 'POST',
        body: JSON.stringify({
          role: 'RIDER',
          email: newEmail || undefined,
          phone: newPhone || undefined,
          expiresInHours: Number(expiresInHours),
        }),
      });
      const inviteLink = `${window.location.origin}/create-account?token=${data.token}`;
      setGeneratedInvite({
        inviteId: data.inviteId,
        token: data.token,
        link: inviteLink,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setInviteError(error.message);
      } else {
        setInviteError('Failed to generate invite code');
      }
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInvite) return;
    navigator.clipboard.writeText(generatedInvite.link);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const ridersQuery = useQuery({
    queryKey: ['riders', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Rider>>(
        `/riders${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
  });

  const assignmentsQuery = useQuery({
    queryKey: ['assignments', 'riders-page'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Assignment>>('/assignments?page=1&pageSize=200&active=true'),
  });

  const riders = useMemo(() => ridersQuery.data?.data ?? [], [ridersQuery.data?.data]);
  const totalRiders = ridersQuery.data?.total ?? 0;

  const filteredRiders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter(
      (r) =>
        r.fullName?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q),
    );
  }, [riders, searchQuery]);

  const activeCount = riders.filter((r) => r.status === 'ACTIVE').length;
  const suspendedCount = riders.filter((r) => r.status === 'SUSPENDED').length;
  const assignedCount = riders.filter(
    (r) => r.activeAssignments && r.activeAssignments.length > 0,
  ).length;

  const handleCreateRider = async () => {
    setCreateError(null);
    try {
      setIsCreating(true);
      await apiFetch('/riders', {
        method: 'POST',
        body: JSON.stringify({
          phone: newPhone || undefined,
          email: newEmail || undefined,
          fullName: newFullName || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
      setShowCreateForm(false);
      setNewPhone('');
      setNewEmail('');
      setNewFullName('');
    } catch (error) {
      if (error instanceof ApiError) {
        setCreateError(error.message);
      } else {
        setCreateError('Failed to create rider');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const columns = useMemo<Array<DataTableColumn<Rider>>>(
    () => [
      {
        header: 'Rider',
        render: (rider) => (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent text-sm font-bold">
              {rider.fullName ? rider.fullName[0].toUpperCase() : '?'}
            </span>
            <div>
              <p className="font-semibold text-ink">
                {rider.fullName ?? `Rider ${rider.id.slice(0, 8)}`}
              </p>
              <p className="text-xs text-ink-muted">
                {rider.email ?? rider.phone ?? 'No contact'}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: 'Status',
        render: (rider) => (
          <Badge
            label={formatEnumLabel(rider.status)}
            tone={
              rider.status === 'ACTIVE'
                ? 'success'
                : rider.status === 'SUSPENDED'
                  ? 'danger'
                  : 'neutral'
            }
          />
        ),
      },
      {
        header: 'Assigned Bike',
        render: (rider) => {
          const assignment = rider.activeAssignments?.[0];
          if (!assignment) {
            return <span className="text-sm text-ink-muted">Unassigned</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <Bike size={13} className="text-accent" />
              <span className="text-sm text-ink">{assignment.bikeLabel}</span>
            </div>
          );
        },
      },
      {
        header: 'Contact',
        render: (rider) => (
          <div className="space-y-1">
            {rider.phone && (
              <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                <Phone size={10} />
                {rider.phone}
              </div>
            )}
            {rider.email && (
              <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                <Mail size={10} />
                {rider.email}
              </div>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ridersQuery.isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Riders"
              value={String(totalRiders)}
              hint="All registered riders in this fleet"
              icon={<Users size={18} />}
              tone="info"
            />
            <MetricCard
              title="Active"
              value={String(activeCount)}
              hint="Riders with active status"
              icon={<UserRound size={18} />}
              tone="success"
            />
            <MetricCard
              title="Assigned"
              value={String(assignedCount)}
              hint="Riders with an active bike assignment"
              icon={<Bike size={18} />}
              tone="info"
            />
            <MetricCard
              title="Suspended"
              value={String(suspendedCount)}
              hint="Riders temporarily removed from operations"
              icon={<Shield size={18} />}
              tone={suspendedCount > 0 ? 'warning' : 'neutral'}
            />
          </>
        )}
      </section>

      {/* Rider registry */}
      <DashboardCard
        eyebrow="Personnel"
        title="Rider registry"
        actions={
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20"
          >
            <UserPlus size={14} />
            Add rider
          </button>
        }
      >
        {/* Create form */}
        {showCreateForm && (
          <div className="mb-6 rounded-2xl border border-line bg-surface-muted p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-ink">Create new rider</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setGeneratedInvite(null);
                }}
                className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab Swifter */}
            <div className="mb-5 flex border-b border-line">
              <button
                type="button"
                onClick={() => {
                  setFormMode('direct');
                  setGeneratedInvite(null);
                  setInviteError(null);
                  setCreateError(null);
                }}
                className={cx(
                  "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all duration-200 outline-none",
                  formMode === 'direct'
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink"
                )}
              >
                <UserRound size={14} />
                Register Directly
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormMode('invite');
                  setGeneratedInvite(null);
                  setInviteError(null);
                  setCreateError(null);
                }}
                className={cx(
                  "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all duration-200 outline-none",
                  formMode === 'invite'
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink"
                )}
              >
                <KeyRound size={14} />
                Generate Invite Link
              </button>
            </div>

            {formMode === 'direct' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm font-medium text-ink">
                  Full name
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="John Doe"
                    className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                  />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Phone
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+254..."
                    className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                  />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Email
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="rider@fleet.co"
                    className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-sm font-medium text-ink">
                    Rider's email (optional constraint)
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="rider@fleet.co"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Rider's phone (optional constraint)
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+254..."
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Expiry duration (hours)
                    <input
                      type="number"
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(e.target.value)}
                      min="1"
                      max="720"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                    />
                  </label>
                </div>

                {generatedInvite && (
                  <div className="mt-4 rounded-xl border border-success-ink/20 bg-success-soft/30 p-4 animate-scale-in">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-success-ink flex items-center gap-1.5">
                        <Check size={16} /> Invite Code Generated Successfully!
                      </h4>
                    </div>
                    <p className="text-xs text-success-ink/80 mb-3">
                      Share this unique link with the rider. They can register their account directly.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedInvite.link}
                        className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-ink outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
                      >
                        {copiedInvite ? <Check size={13} /> : <Copy size={13} />}
                        {copiedInvite ? 'Copied' : 'Copy link'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {createError && (
              <p className="mt-3 rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-2.5 text-sm text-danger-ink">
                {createError}
              </p>
            )}

            {inviteError && (
              <p className="mt-3 rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-2.5 text-sm text-danger-ink">
                {inviteError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setGeneratedInvite(null);
                  setInviteError(null);
                  setCreateError(null);
                }}
                className="rounded-xl border border-line bg-surface-hover px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted"
              >
                Close
              </button>
              {formMode === 'direct' ? (
                <button
                  type="button"
                  disabled={isCreating || (!newPhone && !newEmail)}
                  onClick={() => void handleCreateRider()}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create rider'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isGeneratingInvite}
                  onClick={() => void handleGenerateInvite()}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingInvite ? 'Generating...' : 'Generate Invite Link'}
                </button>
              )}
            </div>
          </div>
        )}

        <DataTableToolbar>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, or phone..."
              className="w-full rounded-xl border border-line bg-surface-hover py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
            />
          </div>
        </DataTableToolbar>

        <div className="mt-4">
          <DataTable
            data={filteredRiders}
            columns={columns}
            keyExtractor={(rider) => rider.id}
            loading={ridersQuery.isLoading}
            emptyState={
              <EmptyState
                icon={<Users size={18} />}
                title="No riders found"
                description="Add riders to your fleet to manage assignments and track performance."
              />
            }
          />
        </div>

        <PaginationControls
          page={ridersQuery.data?.page ?? page}
          totalPages={ridersQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </DashboardCard>
    </div>
  );
}

