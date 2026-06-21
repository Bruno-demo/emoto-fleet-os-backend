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
import { compressImage } from '@/lib/image';
import { Drawer } from '@/components/ui/drawer';
import { useTranslation } from '@/components/i18n/LanguageProvider';

const PAGE_SIZE = 20;

export default function RidersPage() {
  const { t } = useTranslation();
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
  const [newPassword, setNewPassword] = useState('');
  const [newLicenceNumber, setNewLicenceNumber] = useState('');
  const [newIdentityNumber, setNewIdentityNumber] = useState('');
  const [newPassportPhoto, setNewPassportPhoto] = useState('');
  const [newLicencePhoto, setNewLicencePhoto] = useState('');
  const [newIdentityCardPhoto, setNewIdentityCardPhoto] = useState('');
  const [isCompresingPassport, setIsCompresingPassport] = useState(false);
  const [isCompresingLicence, setIsCompresingLicence] = useState(false);
  const [isCompresingIdentity, setIsCompresingIdentity] = useState(false);

  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);


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
        setInviteError(t('Failed to generate invite code'));
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
    const query = searchQuery.trim().toLowerCase();
    if (!query) return riders;

    const tokens = query.split(/\s+/).filter(Boolean);
    return riders.filter((r) => {
      const assignment = r.activeAssignments?.[0];
      const bikeLabel = assignment ? assignment.bikeLabel : 'unassigned';
      
      return tokens.every((token) => {
        return [
          r.fullName,
          r.email,
          r.phone,
          r.status,
          formatEnumLabel(r.status),
          bikeLabel,
        ]
          .filter((val): val is string => !!val)
          .some((val) => val.toLowerCase().includes(token));
      });
    });
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
          password: newPassword || undefined,
          licenceNumber: newLicenceNumber || undefined,
          identityNumber: newIdentityNumber || undefined,
          passportPhoto: newPassportPhoto || undefined,
          licencePhoto: newLicencePhoto || undefined,
          identityCardPhoto: newIdentityCardPhoto || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
      setShowCreateForm(false);
      setNewPhone('');
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
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

  const columns = useMemo<Array<DataTableColumn<Rider>>>(
    () => [
      {
        header: t('Rider'),
        render: (rider) => (
          <div className="flex items-center gap-3">
            {rider.passportPhoto ? (
              <img
                src={rider.passportPhoto}
                alt={rider.fullName ?? t('Rider')}
                className="h-9 w-9 rounded-xl object-cover border border-line"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent text-sm font-bold">
                {rider.fullName ? rider.fullName[0].toUpperCase() : '?'}
              </span>
            )}
            <div>
              <p className="font-semibold text-ink">
                {rider.fullName ?? `${t('Rider')} ${rider.id.slice(0, 8)}`}
              </p>
              <p className="text-xs text-ink-muted">
                {rider.email ?? rider.phone ?? t('No contact')}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: t('Status'),
        render: (rider) => (
          <Badge
            label={t(formatEnumLabel(rider.status))}
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
        header: t('Assigned Bike'),
        render: (rider) => {
          const assignment = rider.activeAssignments?.[0];
          if (!assignment) {
            return <span className="text-sm text-ink-muted">{t('Unassigned')}</span>;
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
        header: t('Contact'),
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
    [t],
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
              title={t("Total Riders")}
              value={String(totalRiders)}
              hint={t("All registered riders in this fleet")}
              icon={<Users size={18} />}
              tone="info"
            />
            <MetricCard
              title={t("Active")}
              value={String(activeCount)}
              hint={t("Riders with active status")}
              icon={<UserRound size={18} />}
              tone="success"
            />
            <MetricCard
              title={t("Assigned")}
              value={String(assignedCount)}
              hint={t("Riders with an active bike assignment")}
              icon={<Bike size={18} />}
              tone="info"
            />
            <MetricCard
              title={t("Suspended")}
              value={String(suspendedCount)}
              hint={t("Riders temporarily removed from operations")}
              icon={<Shield size={18} />}
              tone={suspendedCount > 0 ? 'warning' : 'neutral'}
            />
          </>
        )}
      </section>

      {/* Rider registry */}
      <DashboardCard
        eyebrow={t("Personnel")}
        title={t("Rider registry")}
        actions={
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 whitespace-nowrap"
          >
            <UserPlus size={14} />
            {t("Add rider")}
          </button>
        }
      >
        {/* Create form */}
        {showCreateForm && (
          <div className="mb-6 rounded-2xl border border-line bg-surface-muted p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-ink">{t("Create new rider")}</h3>
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
            <div className="mb-5 flex overflow-x-auto dashboard-scrollbar border-b border-line whitespace-nowrap">
              <button
                type="button"
                onClick={() => {
                  setFormMode('direct');
                  setGeneratedInvite(null);
                  setInviteError(null);
                  setCreateError(null);
                }}
                className={cx(
                  "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all duration-200 outline-none shrink-0",
                  formMode === 'direct'
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink"
                )}
              >
                <UserRound size={14} />
                {t("Register Directly")}
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
                  "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all duration-200 outline-none shrink-0",
                  formMode === 'invite'
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink"
                )}
              >
                <KeyRound size={14} />
                {t("Generate Invite Link")}
              </button>
            </div>

            {formMode === 'direct' ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-ink">
                    {t("Full name")}
                    <input
                      type="text"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder={t("John Doe")}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Phone")}
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+254..."
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Email")}
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="rider@fleet.co"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Password")}
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("At least 8 characters")}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Driving Licence Number")}
                    <input
                      type="text"
                      value={newLicenceNumber}
                      onChange={(e) => setNewLicenceNumber(e.target.value)}
                      placeholder="e.g. DL-12345"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Identity Card Number")}
                    <input
                      type="text"
                      value={newIdentityNumber}
                      onChange={(e) => setNewIdentityNumber(e.target.value)}
                      placeholder="e.g. ID-54321"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 mt-4">
                  {/* Passport Photo upload */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("Passport Photo")}</label>
                    {newPassportPhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[120px]">
                        <img src={newPassportPhoto} alt={t("Passport")} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewPassportPhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-hover p-4 cursor-pointer hover:border-accent/30 transition h-[120px]">
                        <span className="text-xl mb-1">👤</span>
                        <span className="text-[10px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingPassport ? t('Compresing...') : t('Upload Passport Photo')}
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

                  {/* Licence Photo upload */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("Licence Photo")}</label>
                    {newLicencePhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[120px]">
                        <img src={newLicencePhoto} alt={t("Licence")} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewLicencePhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-hover p-4 cursor-pointer hover:border-accent/30 transition h-[120px]">
                        <span className="text-xl mb-1">💳</span>
                        <span className="text-[10px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingLicence ? t('Compresing...') : t('Upload Licence Photo')}
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

                  {/* Identity Card Photo upload */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("ID Card Photo")}</label>
                    {newIdentityCardPhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[120px]">
                        <img src={newIdentityCardPhoto} alt={t("ID Card")} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewIdentityCardPhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-hover p-4 cursor-pointer hover:border-accent/30 transition h-[120px]">
                        <span className="text-xl mb-1">📇</span>
                        <span className="text-[10px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingIdentity ? t('Compresing...') : t('Upload ID Card Photo')}
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
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-sm font-medium text-ink">
                    {t("Rider's email (optional constraint)")}
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="rider@fleet.co"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Rider's phone (optional constraint)")}
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+254..."
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Expiry duration (hours)")}
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
                        <Check size={16} /> {t("Invite Code Generated Successfully!")}
                      </h4>
                    </div>
                    <p className="text-xs text-success-ink/80 mb-3">
                      {t("Share this unique link with the rider. They can register their account directly.")}
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
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
                        style={{ background: '#3B82F6', color: 'white' }}
                      >
                        {copiedInvite ? <Check size={13} /> : <Copy size={13} />}
                        {copiedInvite ? t('Copied') : t('Copy link')}
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
                {t("Close")}
              </button>
              {formMode === 'direct' ? (
                <button
                  type="button"
                  disabled={isCreating || (!newPhone && !newEmail) || !newPassword || newPassword.length < 8}
                  onClick={() => void handleCreateRider()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#3B82F6', color: 'white' }}
                >
                  {isCreating ? t('Creating...') : t('Create rider')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isGeneratingInvite}
                  onClick={() => void handleGenerateInvite()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#3B82F6', color: 'white' }}
                >
                  {isGeneratingInvite ? t('Generating...') : t('Generate Invite Link')}
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
              placeholder={t("Search name, email, phone, status, or assigned bike...")}
              className="w-full rounded-xl border border-line bg-surface-hover py-2.5 pl-10 pr-10 text-sm text-ink placeholder:text-ink-muted outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                aria-label={t("Clear search")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </DataTableToolbar>

        <div className="mt-4">
          <DataTable
            data={filteredRiders}
            columns={columns}
            keyExtractor={(rider) => rider.id}
            loading={ridersQuery.isLoading}
            onRowClick={setSelectedRider}
            emptyState={
              <EmptyState
                icon={<Users size={18} />}
                title={t("No riders found")}
                description={t("Add riders to your fleet to manage assignments and track performance.")}
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

      <Drawer
        open={!!selectedRider}
        title={selectedRider?.fullName ?? t('Rider Profile')}
        description={t("Rider contact information, active bike assignment, and onboarding documents.")}
        onClose={() => setSelectedRider(null)}
      >
        {!selectedRider ? null : (
          <div className="space-y-6">
            {/* Passport Photo */}
            <div className="flex justify-center">
              {selectedRider.passportPhoto ? (
                <div className="relative rounded-2xl border border-line overflow-hidden w-28 h-28">
                  <img src={selectedRider.passportPhoto} alt={selectedRider.fullName ?? t('Passport')} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-line bg-surface-muted w-28 h-28 text-3xl">
                  👤
                </div>
              )}
            </div>

            {/* Profile Grid */}
            <section className="grid gap-3 sm:grid-cols-2">
              <KeyMetric label={t("Full Name")} value={<span>{selectedRider.fullName ?? '—'}</span>} />
              <KeyMetric label={t("Status")} value={
                <Badge
                  label={t(formatEnumLabel(selectedRider.status))}
                  tone={
                    selectedRider.status === 'ACTIVE'
                      ? 'success'
                      : selectedRider.status === 'SUSPENDED'
                        ? 'danger'
                        : 'neutral'
                  }
                />
              } />
              <KeyMetric label={t("Phone")} value={<span>{selectedRider.phone ?? '—'}</span>} />
              <KeyMetric label={t("Email")} value={<span>{selectedRider.email ?? '—'}</span>} />
              <KeyMetric label={t("Licence Number")} value={<span>{selectedRider.licenceNumber ?? '—'}</span>} />
              <KeyMetric label={t("Identity Card Number")} value={<span>{selectedRider.identityNumber ?? '—'}</span>} />
              <KeyMetric
                label={t("Assigned Bike")}
                value={
                  <span>
                    {selectedRider.activeAssignments?.[0]?.bikeLabel ?? t('Unassigned')}
                  </span>
                }
              />
            </section>

            {/* Documents Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{t("Document Attachments")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-ink-muted">{t("Driving Licence")}</p>
                  {selectedRider.licencePhoto ? (
                    <div className="rounded-xl border border-line bg-surface-muted overflow-hidden max-h-[160px] cursor-zoom-in" onClick={() => window.open(selectedRider.licencePhoto || undefined)}>
                      <img src={selectedRider.licencePhoto} alt={t("Licence")} className="w-full object-cover max-h-[160px]" />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line bg-surface-muted p-4 text-center text-xs text-ink-faint">
                      {t("No Licence Photo Uploaded")}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-ink-muted">{t("Identity Card")}</p>
                  {selectedRider.identityCardPhoto ? (
                    <div className="rounded-xl border border-line bg-surface-muted overflow-hidden max-h-[160px] cursor-zoom-in" onClick={() => window.open(selectedRider.identityCardPhoto || undefined)}>
                      <img src={selectedRider.identityCardPhoto} alt={t("Identity Card")} className="w-full object-cover max-h-[160px]" />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line bg-surface-muted p-4 text-center text-xs text-ink-faint">
                      {t("No Identity Card Photo Uploaded")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function KeyMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

