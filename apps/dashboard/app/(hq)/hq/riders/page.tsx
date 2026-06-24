'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api/client';
import { z } from 'zod';
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
  Trash2,
  UserX,
  CheckCircle2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { buildQueryString } from '@/lib/api/query-string';
import { cx, formatEnumLabel } from '@/lib/ui';
import { compressImage } from '@/lib/image';

interface HqRider {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'PENDING_SETUP';
  fleet?: { id: string; name: string } | null;
  bikeAssignments?: Array<{
    id: string;
    bike: { id: string; label: string } | null;
  }> | null;
  riderProfile?: {
    fullName?: string | null;
    passportPhoto?: string | null;
    licenceNumber?: string | null;
    identityNumber?: string | null;
    leaseToOwn?: boolean | null;
    leasePrincipal?: number | null;
    leaseDailyRate?: number | null;
    licencePhoto?: string | null;
    identityCardPhoto?: string | null;
  } | null;
}

const PAGE_SIZE = 25;

export default function HqRidersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  // Page / filtering states
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterFleetId, setFilterFleetId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Sidebar / Drawer / modal states
  const [selectedRider, setSelectedRider] = useState<HqRider | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formMode, setFormMode] = useState<'direct' | 'invite'>('direct');

  // Direct registration form states
  const [newFleetId, setNewFleetId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newLicenceNumber, setNewLicenceNumber] = useState('');
  const [newIdentityNumber, setNewIdentityNumber] = useState('');
  const [newPassportPhoto, setNewPassportPhoto] = useState('');
  const [newLicencePhoto, setNewLicencePhoto] = useState('');
  const [newIdentityCardPhoto, setNewIdentityCardPhoto] = useState('');
  const [leaseToOwn, setLeaseToOwn] = useState(false);
  const [leasePrincipal, setLeasePrincipal] = useState('2500000');
  const [leaseDailyRate, setLeaseDailyRate] = useState('15000');
  
  const [isCompresingPassport, setIsCompresingPassport] = useState(false);
  const [isCompresingLicence, setIsCompresingLicence] = useState(false);
  const [isCompresingIdentity, setIsCompresingIdentity] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Invite generation form states
  const [expiresInHours, setExpiresInHours] = useState('168');
  const [generatedInvite, setGeneratedInvite] = useState<{ inviteId: string; token: string; link: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // ConfirmModals states
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusTargetId, setStatusTargetId] = useState<string | null>(null);
  const [statusTargetName, setStatusTargetName] = useState<string | null>(null);
  const [statusTargetNext, setStatusTargetNext] = useState<'ACTIVE' | 'SUSPENDED' | 'DISABLED'>('ACTIVE');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string | null>(null);

  // Queries
  const { data: fleetsList } = useQuery({
    queryKey: ['hq', 'fleets-list'],
    queryFn: () => apiFetch('/hq/fleets?pageSize=200', {}).then((res) => {
      const r = res as { data?: Array<{ id: string; name: string }> };
      return (r.data ?? r) as Array<{ id: string; name: string }>;
    }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'riders', page, search, filterFleetId, filterStatus],
    queryFn: () => {
      const queryStr = buildQueryString({
        role: 'RIDER',
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: filterStatus || undefined,
        fleetId: filterFleetId || undefined,
      });
      return apiFetch<{ data: HqRider[]; total: number; page: number; totalPages: number }>(`/hq/users${queryStr}`, {});
    },
  });

  // Mutations
  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' }) =>
      apiFetch<{ status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' }>(`/hq/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'riders'] });
      if (selectedRider && selectedRider.id === statusTargetId) {
        setSelectedRider((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: statusTargetNext
          };
        });
      }
      setStatusConfirmOpen(false);
      setStatusTargetId(null);
      setStatusTargetName(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/hq/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'riders'] });
      setSelectedRider(null);
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
      setDeleteTargetName(null);
    },
  });

  const handleGenerateInvite = async () => {
    setInviteError(null);
    setIsGeneratingInvite(true);
    setGeneratedInvite(null);
    if (!newFleetId) {
      setInviteError(t('Please select a fleet for invite.'));
      setIsGeneratingInvite(false);
      return;
    }
    try {
      const data = await apiFetch<{ inviteId: string; token: string }>('/auth/invites', {
        method: 'POST',
        body: JSON.stringify({
          role: 'RIDER',
          fleetId: newFleetId,
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
        setInviteError(t('Failed to generate invite code'));
      }
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCreateRider = async () => {
    setCreateError(null);
    if (!newFleetId) {
      setCreateError(t('Fleet assignment is required.'));
      return;
    }
    if (!newFullName) {
      setCreateError(t('Full name is required.'));
      return;
    }
    if (!newPhone && !newEmail) {
      setCreateError(t('Either email or phone number is required.'));
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setCreateError(t('Password must be at least 8 characters.'));
      return;
    }
    if (!newLicenceNumber) {
      setCreateError(t('Driving licence number is required.'));
      return;
    }
    if (!newIdentityNumber) {
      setCreateError(t('Identity card number is required.'));
      return;
    }
    if (!newPassportPhoto) {
      setCreateError(t('Passport photo is required.'));
      return;
    }
    if (!newLicencePhoto) {
      setCreateError(t('Licence photo is required.'));
      return;
    }
    if (!newIdentityCardPhoto) {
      setCreateError(t('Identity card photo is required.'));
      return;
    }
    if (leaseToOwn) {
      if (!leasePrincipal || parseFloat(leasePrincipal) <= 0) {
        setCreateError(t('Lease principal must be a positive number.'));
        return;
      }
      if (!leaseDailyRate || parseFloat(leaseDailyRate) <= 0) {
        setCreateError(t('Lease daily rate must be a positive number.'));
        return;
      }
    }

    try {
      setIsCreating(true);
      await apiFetch(`/hq/fleets/${newFleetId}/users`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'RIDER',
          phone: newPhone || undefined,
          email: newEmail || undefined,
          fullName: newFullName || undefined,
          password: newPassword || undefined,
          licenceNumber: newLicenceNumber || undefined,
          identityNumber: newIdentityNumber || undefined,
          passportPhoto: newPassportPhoto || undefined,
          licencePhoto: newLicencePhoto || undefined,
          identityCardPhoto: newIdentityCardPhoto || undefined,
          leaseToOwn,
          leasePrincipal: leaseToOwn ? Number(leasePrincipal) : undefined,
          leaseDailyRate: leaseToOwn ? Number(leaseDailyRate) : undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['hq', 'riders'] });
      setShowCreateForm(false);
      setNewFleetId('');
      setNewPhone('');
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setLeaseToOwn(false);
      setLeasePrincipal('2500000');
      setLeaseDailyRate('15000');
      setNewLicenceNumber('');
      setNewIdentityNumber('');
      setNewPassportPhoto('');
      setNewLicencePhoto('');
      setNewIdentityCardPhoto('');
    } catch (error) {
      if (error instanceof ApiError) {
        setCreateError(error.message);
      } else {
        setCreateError(t('Failed to create rider'));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInvite) return;
    navigator.clipboard.writeText(generatedInvite.link);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  // Client side filtering & counts
  const ridersList = data?.data ?? [];
  const totalRidersCount = data?.total ?? 0;

  const metrics = useMemo(() => {
    const active = ridersList.filter((r: HqRider) => r.status === 'ACTIVE').length;
    const suspended = ridersList.filter((r: HqRider) => r.status === 'SUSPENDED').length;
    const assigned = ridersList.filter((r: HqRider) => r.bikeAssignments && r.bikeAssignments.length > 0).length;
    return { active, suspended, assigned };
  }, [ridersList]);

  const isDirectFormInvalid = useMemo(() => {
    if (!newFleetId || !newFullName || !newPassword || newPassword.length < 8) return true;
    if (!newPhone && !newEmail) return true;
    if (!newLicenceNumber || !newIdentityNumber) return true;
    if (!newPassportPhoto || !newLicencePhoto || !newIdentityCardPhoto) return true;
    if (leaseToOwn) {
      if (!leasePrincipal || !leaseDailyRate) return true;
    }
    return false;
  }, [
    newFleetId,
    newFullName,
    newPassword,
    newPhone,
    newEmail,
    leaseToOwn,
    newLicenceNumber,
    newIdentityNumber,
    newPassportPhoto,
    newLicencePhoto,
    newIdentityCardPhoto,
    leasePrincipal,
    leaseDailyRate,
  ]);

  const columns: Array<DataTableColumn<HqRider>> = [
    {
      header: t('Rider'),
      render: (rider) => {
        const profile = rider.riderProfile;
        const name = profile?.fullName ?? rider.fullName ?? `${t('Rider')} ${rider.id.slice(0, 8)}`;
        return (
          <div className="flex items-center gap-3">
            {profile?.passportPhoto ? (
              <img
                src={profile.passportPhoto}
                alt={name}
                className="h-9 w-9 rounded-xl object-cover border border-line"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent text-xs font-bold">
                {name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <div>
              <p className="font-semibold text-ink leading-tight">{name}</p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {rider.email ?? rider.phone ?? t('No contact info')}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: t('Fleet'),
      render: (rider) => <span className="text-xs text-ink-soft">{rider.fleet?.name ?? '—'}</span>,
    },
    {
      header: t('Status'),
      render: (rider) => {
        const tone = 
          rider.status === 'ACTIVE' 
            ? 'success' 
            : rider.status === 'SUSPENDED' 
              ? 'danger' 
              : rider.status === 'DISABLED' 
                ? 'danger' 
                : rider.status === 'INVITED' 
                  ? 'info' 
                  : 'neutral';
        return <Badge tone={tone} label={formatEnumLabel(rider.status)} />;
      },
    },
    {
      header: t('Assigned Bike'),
      render: (rider) => {
        const assignment = rider.bikeAssignments?.[0];
        if (!assignment || !assignment.bike) {
          return <span className="text-xs text-ink-faint">{t('Unassigned')}</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <Bike size={13} className="text-accent" />
            <span className="text-xs text-ink font-medium">{assignment.bike.label}</span>
          </div>
        );
      },
    },
    {
      header: t('Contact'),
      render: (rider) => (
        <div className="space-y-1">
          {rider.phone && (
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <Phone size={10} className="text-ink-faint" />
              {rider.phone}
            </div>
          )}
          {rider.email && (
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <Mail size={10} className="text-ink-faint" />
              {rider.email}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Section */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              title={t('Total Riders')}
              value={totalRidersCount.toLocaleString()}
              hint={t('All riders registered globally')}
              icon={<Users size={18} />}
              tone="info"
            />
            <MetricCard
              title={t('Active')}
              value={metrics.active.toLocaleString()}
              hint={t('Riders active on duty')}
              icon={<UserRound size={18} />}
              tone="success"
            />
            <MetricCard
              title={t('Assigned')}
              value={metrics.assigned.toLocaleString()}
              hint={t('Riders currently on a bike')}
              icon={<Bike size={18} />}
              tone="info"
            />
            <MetricCard
              title={t('Suspended')}
              value={metrics.suspended.toLocaleString()}
              hint={t('Suspended rider profiles')}
              icon={<Shield size={18} />}
              tone={metrics.suspended > 0 ? 'warning' : 'neutral'}
            />
          </>
        )}
      </section>

      {/* Main Table Card */}
      <DashboardCard
        eyebrow={t('Personnel')}
        title={t('Rider registry')}
        actions={
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-white hover:brightness-115 transition-all shadow-md shadow-accent/15"
          >
            <UserPlus size={14} />
            {t('Add Rider')}
          </button>
        }
      >
        <div className="space-y-4">
          {/* Collapsible Direct / Invite Form */}
          {showCreateForm && (
            <div className="rounded-2xl border border-line bg-surface-muted p-5 animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-bold text-ink">{t('Register new rider account')}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setGeneratedInvite(null);
                  }}
                  className="rounded-lg p-1 text-ink-faint hover:text-ink hover:bg-surface transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Tabs */}
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
                    "px-4 py-2.5 text-xs font-bold border-b-2 transition-all outline-none",
                    formMode === 'direct'
                      ? "border-accent text-accent"
                      : "border-transparent text-ink-faint hover:text-ink-soft"
                  )}
                >
                  {t('Register Directly')}
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
                    "px-4 py-2.5 text-xs font-bold border-b-2 transition-all outline-none",
                    formMode === 'invite'
                      ? "border-accent text-accent"
                      : "border-transparent text-ink-faint hover:text-ink-soft"
                  )}
                >
                  {t('Generate Invite Link')}
                </button>
              </div>

              {/* Common Fleet Selection */}
              <div className="mb-4 max-w-sm">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft mb-2">{t('Assign Fleet')}</label>
                <select
                  value={newFleetId}
                  onChange={(e) => setNewFleetId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-line bg-surface px-4 text-sm text-ink outline-none transition focus:border-accent"
                >
                  <option value="">— {t('Select a fleet')} —</option>
                  {(fleetsList ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {formMode === 'direct' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <label className="block text-xs font-semibold text-ink">
                      {t('Full Name')}
                      <input
                        type="text"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Phone Number')}
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="e.g. +250..."
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Email Address')}
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="e.g. rider@fleet.co"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Password')}
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('At least 8 characters')}
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Driving Licence Number')}
                      <input
                        type="text"
                        value={newLicenceNumber}
                        onChange={(e) => setNewLicenceNumber(e.target.value)}
                        placeholder="e.g. DL-12345"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Identity Card Number')}
                      <input
                        type="text"
                        value={newIdentityNumber}
                        onChange={(e) => setNewIdentityNumber(e.target.value)}
                        placeholder="e.g. ID-54321"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Payment Plan')}
                      <select
                        value={leaseToOwn ? 'lease' : 'collect'}
                        onChange={(e) => setLeaseToOwn(e.target.value === 'lease')}
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink outline-none focus:border-accent cursor-pointer"
                      >
                        <option value="collect">{t('Daily Collection')}</option>
                        <option value="lease">{t('Lease-to-Own')}</option>
                      </select>
                    </label>
                    {leaseToOwn && (
                      <>
                        <label className="block text-xs font-semibold text-ink">
                          {t('Lease Principal Amount (RWF)')}
                          <input
                            type="number"
                            value={leasePrincipal}
                            onChange={(e) => setLeasePrincipal(e.target.value)}
                            className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink outline-none focus:border-accent"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-ink">
                          {t('Lease Daily Rate (RWF)')}
                          <input
                            type="number"
                            value={leaseDailyRate}
                            onChange={(e) => setLeaseDailyRate(e.target.value)}
                            className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink outline-none focus:border-accent"
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Image uploads grid */}
                  <div className="grid gap-4 sm:grid-cols-3 mt-4">
                    {/* Passport Photo */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('Passport Photo')}</label>
                      {newPassportPhoto ? (
                        <div className="relative group rounded-xl border border-line overflow-hidden h-[120px]">
                          <img src={newPassportPhoto} alt="Passport" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setNewPassportPhoto('')}
                            className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface p-4 cursor-pointer hover:border-accent/30 transition h-[120px]">
                          <span className="text-xl mb-1">👤</span>
                          <span className="text-[10px] font-semibold text-ink-muted text-center leading-tight">
                            {isCompresingPassport ? t('Compressing...') : t('Upload Passport Photo')}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isCompresingPassport}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsCompresingPassport(true);
                                  const compressed = await compressImage(file);
                                  setNewPassportPhoto(compressed);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setIsCompresingPassport(false);
                                }
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Licence Photo */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('Licence Photo')}</label>
                      {newLicencePhoto ? (
                        <div className="relative group rounded-xl border border-line overflow-hidden h-[120px]">
                          <img src={newLicencePhoto} alt="Licence" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setNewLicencePhoto('')}
                            className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface p-4 cursor-pointer hover:border-accent/30 transition h-[120px]">
                          <span className="text-xl mb-1">💳</span>
                          <span className="text-[10px] font-semibold text-ink-muted text-center leading-tight">
                            {isCompresingLicence ? t('Compressing...') : t('Upload Licence Photo')}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isCompresingLicence}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsCompresingLicence(true);
                                  const compressed = await compressImage(file);
                                  setNewLicencePhoto(compressed);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setIsCompresingLicence(false);
                                }
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* ID Card Photo */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('ID Card Photo')}</label>
                      {newIdentityCardPhoto ? (
                        <div className="relative group rounded-xl border border-line overflow-hidden h-[120px]">
                          <img src={newIdentityCardPhoto} alt="ID Card" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setNewIdentityCardPhoto('')}
                            className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface p-4 cursor-pointer hover:border-accent/30 transition h-[120px]">
                          <span className="text-xl mb-1">📇</span>
                          <span className="text-[10px] font-semibold text-ink-muted text-center leading-tight">
                            {isCompresingIdentity ? t('Compressing...') : t('Upload ID Card Photo')}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isCompresingIdentity}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsCompresingIdentity(true);
                                  const compressed = await compressImage(file);
                                  setNewIdentityCardPhoto(compressed);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setIsCompresingIdentity(false);
                                }
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {createError && (
                    <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-2.5 text-xs text-danger-ink">{createError}</p>
                  )}

                  <div className="flex justify-end gap-2 mt-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover transition"
                    >
                      {t('Close')}
                    </button>
                    <button
                      type="button"
                      disabled={isCreating || isDirectFormInvalid}
                      onClick={handleCreateRider}
                      className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {isCreating ? t('Creating...') : t('Create rider')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-semibold text-ink">
                      {t('Rider\'s email (optional constraint)')}
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="rider@fleet.co"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Rider\'s phone (optional constraint)')}
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="e.g. +250..."
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink">
                      {t('Expiry duration (hours)')}
                      <input
                        type="number"
                        value={expiresInHours}
                        onChange={(e) => setExpiresInHours(e.target.value)}
                        min="1"
                        max="720"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-xs text-ink outline-none focus:border-accent"
                      />
                    </label>
                  </div>

                  {generatedInvite && (
                    <div className="mt-4 rounded-xl border border-success-ink/20 bg-success-soft/30 p-4 animate-scale-in">
                      <h4 className="text-xs font-bold text-success-ink flex items-center gap-1.5 mb-1.5">
                        <CheckCircle2 size={15} /> {t('Invite Link Generated!')}
                      </h4>
                      <p className="text-[11px] text-success-ink/80 mb-3">
                        {t('Share this link with the rider so they can setup their profile.')}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedInvite.link}
                          className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-xs text-ink font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="h-10 rounded-xl bg-accent px-4 text-xs font-bold text-white hover:brightness-110 transition flex items-center gap-1.5"
                        >
                          {copiedInvite ? <Check size={14} /> : <Copy size={14} />}
                          {copiedInvite ? t('Copied') : t('Copy')}
                        </button>
                      </div>
                    </div>
                  )}

                  {inviteError && (
                    <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-2.5 text-xs text-danger-ink">{inviteError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover transition"
                    >
                      {t('Close')}
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingInvite}
                      onClick={handleGenerateInvite}
                      className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {isGeneratingInvite ? t('Generating...') : t('Generate Invite Link')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filters Toolbar */}
          <DataTableToolbar>
            <div className="flex flex-col gap-3 w-full">
              <div className="relative group max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint group-focus-within:text-accent transition-colors" size={15} />
                <input
                  type="text"
                  placeholder={t('Search name, email, phone...')}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterFleetId}
                  onChange={(e) => { setFilterFleetId(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft focus:border-accent focus:outline-none cursor-pointer hover:bg-surface-hover transition"
                >
                  <option value="">{t('All fleets')}</option>
                  {(fleetsList ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft focus:border-accent focus:outline-none cursor-pointer hover:bg-surface-hover transition"
                >
                  <option value="">{t('All statuses')}</option>
                  <option value="ACTIVE">{t('Active')}</option>
                  <option value="SUSPENDED">{t('Suspended')}</option>
                  <option value="DISABLED">{t('Disabled')}</option>
                  <option value="INVITED">{t('Invited')}</option>
                  <option value="PENDING_SETUP">{t('Pending Setup')}</option>
                </select>
              </div>
            </div>
          </DataTableToolbar>

          {/* Riders Table */}
          <DataTable
            data={ridersList}
            columns={columns}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            onRowClick={(row) => setSelectedRider(row)}
          />

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="pt-2">
              <PaginationControls
                page={page}
                totalPages={data.totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      </DashboardCard>

      {/* Rider Detail Drawer */}
      <Drawer
        open={!!selectedRider}
        title={selectedRider ? (selectedRider.riderProfile?.fullName ?? selectedRider.fullName ?? t('Rider Profile')) : ''}
        description={t('Rider Professional Profile')}
        onClose={() => setSelectedRider(null)}
      >
        {selectedRider && (
          <div className="space-y-6">
            {/* Passport Photo */}
            <div className="flex justify-center py-2">
              {selectedRider.riderProfile?.passportPhoto ? (
                <img
                  src={selectedRider.riderProfile?.passportPhoto || undefined}
                  alt="Passport"
                  className="h-28 w-28 rounded-2xl object-cover border-2 border-line shadow-lg"
                />
              ) : (
                <span className="flex h-28 w-28 items-center justify-center rounded-2xl bg-accent/15 text-accent text-3xl font-bold">
                  {selectedRider.riderProfile?.fullName?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            {/* Profile fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <KeyMetric label={t('Full Name')} value={selectedRider.riderProfile?.fullName ?? selectedRider.fullName ?? t('Not set')} />
              <KeyMetric
                label={t('Status')}
                value={
                  <Badge 
                    tone={selectedRider.status === 'ACTIVE' ? 'success' : selectedRider.status === 'SUSPENDED' ? 'danger' : 'neutral'}
                    label={formatEnumLabel(selectedRider.status)}
                  />
                }
              />
              <KeyMetric label={t('Phone Number')} value={selectedRider.phone ?? t('Not set')} />
              <KeyMetric label={t('Email Address')} value={selectedRider.email ?? t('Not set')} />
              <KeyMetric label={t('Licence Number')} value={selectedRider.riderProfile?.licenceNumber ?? t('Not set')} />
              <KeyMetric label={t('Identity card')} value={selectedRider.riderProfile?.identityNumber ?? t('Not set')} />
              <KeyMetric label={t('Fleet')} value={selectedRider.fleet?.name ?? t('Not set')} />
              <KeyMetric
                label={t('Assigned Bike')}
                value={
                  selectedRider.bikeAssignments?.[0]?.bike ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
                      <Bike size={13} />
                      {selectedRider.bikeAssignments[0].bike.label}
                    </span>
                  ) : (
                    <span className="text-ink-faint">{t('Unassigned')}</span>
                  )
                }
              />
              <KeyMetric
                label={t('Payment Plan')}
                value={
                  selectedRider.riderProfile?.leaseToOwn ? (
                    <div>
                      <p className="font-semibold text-ink">{t('Lease-to-Own')}</p>
                      <p className="text-[10px] text-ink-muted mt-0.5">
                        {t('Principal')}: {selectedRider.riderProfile?.leasePrincipal?.toLocaleString()} RWF | {t('Daily')}: {selectedRider.riderProfile?.leaseDailyRate?.toLocaleString()} RWF
                      </p>
                    </div>
                  ) : (
                    t('Daily Collection')
                  )
                }
              />
            </div>

            {/* Document Attachments */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t('Document Attachments')}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-ink-muted">{t('Licence Document')}</p>
                  {selectedRider.riderProfile?.licencePhoto ? (
                    <div 
                      className="rounded-xl border border-line bg-surface-muted overflow-hidden max-h-[140px] cursor-zoom-in group relative" 
                      onClick={() => window.open(selectedRider.riderProfile?.licencePhoto || undefined)}
                    >
                      <img src={selectedRider.riderProfile?.licencePhoto || undefined} alt="Licence" className="w-full object-cover max-h-[140px] group-hover:scale-105 transition duration-300" />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line bg-surface-muted p-4 text-center text-xs text-ink-faint">
                      {t('No licence photo uploaded')}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-ink-muted">{t('Identity Card Document')}</p>
                  {selectedRider.riderProfile?.identityCardPhoto ? (
                    <div 
                      className="rounded-xl border border-line bg-surface-muted overflow-hidden max-h-[140px] cursor-zoom-in group relative" 
                      onClick={() => window.open(selectedRider.riderProfile?.identityCardPhoto || undefined)}
                    >
                      <img src={selectedRider.riderProfile?.identityCardPhoto || undefined} alt="Identity Card" className="w-full object-cover max-h-[140px] group-hover:scale-105 transition duration-300" />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line bg-surface-muted p-4 text-center text-xs text-ink-faint">
                      {t('No identity card photo uploaded')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3 pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t('Rider Management')}</h3>
              <div className="flex flex-wrap gap-2.5">
                {selectedRider.status === 'ACTIVE' ? (
                  <button
                    onClick={() => {
                      setStatusTargetId(selectedRider.id);
                      setStatusTargetName(selectedRider.riderProfile?.fullName ?? selectedRider.fullName ?? 'Rider');
                      setStatusTargetNext('SUSPENDED');
                      setStatusConfirmOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-semibold text-warning-ink hover:bg-warning-soft transition-colors"
                  >
                    <UserX size={14} />
                    {t('Suspend Rider')}
                  </button>
                ) : (
                  (selectedRider.status === 'SUSPENDED' || selectedRider.status === 'DISABLED') && (
                    <button
                      onClick={() => {
                        setStatusTargetId(selectedRider.id);
                        setStatusTargetName(selectedRider.riderProfile?.fullName ?? selectedRider.fullName ?? 'Rider');
                        setStatusTargetNext('ACTIVE');
                        setStatusConfirmOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-md shadow-accent/15"
                    >
                      <UserRound size={14} />
                      {t('Reactivate Rider')}
                    </button>
                  )
                )}
                <button
                  onClick={() => {
                    setDeleteTargetId(selectedRider.id);
                    setDeleteTargetName(selectedRider.riderProfile?.fullName ?? selectedRider.fullName ?? 'Rider');
                    setDeleteConfirmOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-semibold text-danger-ink hover:bg-danger-soft transition-colors"
                >
                  <Trash2 size={14} />
                  {t('Delete Profile')}
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Confirm Modals */}
      <ConfirmModal
        open={statusConfirmOpen}
        title={statusTargetNext === 'SUSPENDED' ? t('Suspend Rider') : t('Reactivate Rider')}
        description={
          statusTargetNext === 'SUSPENDED'
            ? `${t('Are you sure you want to suspend rider')} "${statusTargetName}"? ${t('They will not be able to log in or start bike operations.')}`
            : `${t('Reactivate rider profile for')} "${statusTargetName}"?`
        }
        confirmLabel={statusTargetNext === 'SUSPENDED' ? t('Suspend') : t('Reactivate')}
        tone="default"
        isSubmitting={statusMutation.isPending}
        onConfirm={() => {
          if (statusTargetId) {
            statusMutation.mutate({ userId: statusTargetId, status: statusTargetNext });
          }
        }}
        onCancel={() => {
          setStatusConfirmOpen(false);
          setStatusTargetId(null);
          setStatusTargetName(null);
        }}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        title={t('Delete Rider Profile')}
        description={`${t('Are you sure you want to permanently delete')} "${deleteTargetName}"? ${t('This action is irreversible and deletes their profile and document records.')}`}
        confirmLabel={t('Delete Profile')}
        tone="danger"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteMutation.mutate(deleteTargetId);
          }
        }}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteTargetId(null);
          setDeleteTargetName(null);
        }}
      />
    </div>
  );
}

function KeyMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
