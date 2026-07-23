'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bike,
  Mail,
  Phone,
  Search,
  Shield,
  UserPlus,
  UserRound,
  Users,
  X,
  Copy,
  Check,
  KeyRound,
  Trash2,
  UserX,
  Coins,
  Download,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';

import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { downloadFormattedExcel } from '@/lib/export/excel-export';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { Assignment, PaginatedResponse, Rider } from '@/lib/types/dashboard';
import { cx, formatEnumLabel, getLocalDateString } from '@/lib/ui';
import { compressImage } from '@/lib/image';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useTranslation } from '@/components/i18n/LanguageProvider';

interface RiderPaymentLog {
  id: string;
  amount: number | string;
  paidAt: string;
  method: string;
  status: string;
  reference?: string | null;
  notes?: string | null;
}

interface TrafficFine {
  id: string;
  riderId: string;
  ticketNumber: string;
  reason: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  finedAt: string;
  createdAt: string;
  updatedAt: string;
  rider?: {
    phone?: string;
    riderProfile?: {
      fullName?: string;
    };
  };
}

const PAGE_SIZE = 20;

export default function RidersPage() {
  const { t } = useTranslation();
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
  const [leaseToOwn, setLeaseToOwn] = useState(false);
  const [leasePrincipal, setLeasePrincipal] = useState('2500000');
  const [leaseDailyRate, setLeaseDailyRate] = useState('15000');
  const [isCompresingPassport, setIsCompresingPassport] = useState(false);
  const [isCompresingLicence, setIsCompresingLicence] = useState(false);
  const [isCompresingIdentity, setIsCompresingIdentity] = useState(false);

  // Traffic Fines record states
  const [showRecordFineModal, setShowRecordFineModal] = useState(false);
  const [fineRecordRiderId, setFineRecordRiderId] = useState('');
  const [fineRecordRiderName, setFineRecordRiderName] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [fineTicketNumber, setFineTicketNumber] = useState('');
  const [fineDate, setFineDate] = useState(() => getLocalDateString(new Date()));
  const [recordFineError, setRecordFineError] = useState<string | null>(null);
  const [isRecordingFine, setIsRecordingFine] = useState(false);

  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  const { data: riderFines, refetch: refetchRiderFines } = useQuery({
    queryKey: ['rider-fines', selectedRider?.id],
    queryFn: () =>
      apiFetch<TrafficFine[]>(`/traffic-fines?riderId=${selectedRider?.id}`),
    enabled: !!selectedRider,
  });

  // ConfirmModals states
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusTargetId, setStatusTargetId] = useState<string | null>(null);
  const [statusTargetName, setStatusTargetName] = useState<string | null>(null);
  const [statusTargetNext, setStatusTargetNext] = useState<'ACTIVE' | 'SUSPENDED' | 'DISABLED'>('ACTIVE');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string | null>(null);

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editLicenceNumber, setEditLicenceNumber] = useState('');
  const [editIdentityNumber, setEditIdentityNumber] = useState('');
  const [editPassportPhoto, setEditPassportPhoto] = useState('');
  const [editLicencePhoto, setEditLicencePhoto] = useState('');
  const [editIdentityCardPhoto, setEditIdentityCardPhoto] = useState('');
  const [editLeaseToOwn, setEditLeaseToOwn] = useState(false);
  const [editLeasePrincipal, setEditLeasePrincipal] = useState('2500000');
  const [editLeaseDailyRate, setEditLeaseDailyRate] = useState('15000');

  const [isCompresingEditPassport, setIsCompresingEditPassport] = useState(false);
  const [isCompresingEditLicence, setIsCompresingEditLicence] = useState(false);
  const [isCompresingEditIdentity, setIsCompresingEditIdentity] = useState(false);

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' }) =>
      apiFetch(`/riders/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riders'] });
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
      apiFetch(`/riders/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riders'] });
      setSelectedRider(null);
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
      setDeleteTargetName(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Record<string, unknown> }) =>
      apiFetch<Rider>(`/riders/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (updatedRider: Rider) => {
      queryClient.invalidateQueries({ queryKey: ['riders'] });
      setSelectedRider(updatedRider);
      setIsEditing(false);
      setEditError(null);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setEditError(error.message);
      } else {
        setEditError(t('Failed to update rider details'));
      }
    }
  });

  const startEditing = () => {
    if (!selectedRider) return;
    setEditFullName(selectedRider.fullName ?? '');
    setEditPhone(selectedRider.phone ?? '');
    setEditEmail(selectedRider.email ?? '');
    setEditPassword('');
    setEditLicenceNumber(selectedRider.licenceNumber ?? '');
    setEditIdentityNumber(selectedRider.identityNumber ?? '');
    setEditPassportPhoto(selectedRider.passportPhoto ?? '');
    setEditLicencePhoto(selectedRider.licencePhoto ?? '');
    setEditIdentityCardPhoto(selectedRider.identityCardPhoto ?? '');
    setEditLeaseToOwn(selectedRider.leaseToOwn ?? false);
    setEditLeasePrincipal(String(selectedRider.leasePrincipal ?? '2500000'));
    setEditLeaseDailyRate(String(selectedRider.leaseDailyRate ?? '15000'));
    
    setEditError(null);
    setIsEditing(true);
  };

  const handlePayFine = async (fineId: string) => {
    try {
      await apiFetch(`/traffic-fines/${fineId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAID' }),
      });
      await refetchRiderFines();
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update traffic fine');
    }
  };

  const handleCancelFine = async (fineId: string) => {
    try {
      await apiFetch(`/traffic-fines/${fineId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      await refetchRiderFines();
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update traffic fine');
    }
  };

  const handleRecordFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineAmount || parseFloat(fineAmount) <= 0) {
      setRecordFineError(t('Fine amount must be a positive number.'));
      return;
    }
    if (!fineReason) {
      setRecordFineError(t('Reason is required.'));
      return;
    }
    if (!fineTicketNumber) {
      setRecordFineError(t('Ticket number is required.'));
      return;
    }
    try {
      setIsRecordingFine(true);
      setRecordFineError(null);
      await apiFetch('/traffic-fines', {
        method: 'POST',
        body: JSON.stringify({
          riderId: fineRecordRiderId,
          amount: Number(fineAmount),
          reason: fineReason,
          ticketNumber: fineTicketNumber,
          finedAt: `${fineDate}T12:00:00.000Z`,
        }),
      });
      await refetchRiderFines();
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
      setShowRecordFineModal(false);
      setFineAmount('');
      setFineReason('');
      setFineTicketNumber('');
      setFineRecordRiderId('');
      setFineRecordRiderName('');
    } catch (err: unknown) {
      setRecordFineError(err instanceof Error ? err.message : 'Failed to record fine');
    } finally {
      setIsRecordingFine(false);
    }
  };

  const handleUpdateRider = async () => {
    if (!selectedRider) return;
    setEditError(null);
    if (!editFullName) {
      setEditError(t('Full name is required.'));
      return;
    }
    if (!editPhone && !editEmail) {
      setEditError(t('Phone or email is required.'));
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setEditError(t('Password must be at least 8 characters.'));
      return;
    }
    if (!editLicenceNumber) {
      setEditError(t('Licence number is required.'));
      return;
    }
    if (!editIdentityNumber) {
      setEditError(t('Identity card number is required.'));
      return;
    }
    if (!editPassportPhoto) {
      setEditError(t('Passport photo is required.'));
      return;
    }
    if (!editLicencePhoto) {
      setEditError(t('Licence photo is required.'));
      return;
    }
    if (!editIdentityCardPhoto) {
      setEditError(t('Identity card photo is required.'));
      return;
    }
    if (editLeaseToOwn) {
      if (!editLeasePrincipal || parseFloat(editLeasePrincipal) <= 0) {
        setEditError(t('Lease principal must be a positive number.'));
        return;
      }
    }
    if (!editLeaseDailyRate || parseFloat(editLeaseDailyRate) <= 0) {
      setEditError(t('Lease daily rate must be a positive number.'));
      return;
    }

    updateMutation.mutate({
      userId: selectedRider.id,
      data: {
        phone: editPhone || undefined,
        email: editEmail || undefined,
        fullName: editFullName || undefined,
        password: editPassword || undefined,
        licenceNumber: editLicenceNumber || undefined,
        identityNumber: editIdentityNumber || undefined,
        passportPhoto: editPassportPhoto || undefined,
        licencePhoto: editLicencePhoto || undefined,
        identityCardPhoto: editIdentityCardPhoto || undefined,
        leaseToOwn: editLeaseToOwn,
        leasePrincipal: editLeaseToOwn ? Number(editLeasePrincipal) : null,
        leaseDailyRate: Number(editLeaseDailyRate),
      }
    });
  };


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

  // Rider Financial Statement modal state
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementRider, setStatementRider] = useState<Rider | null>(null);
  const [statementFrom, setStatementFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // default 30 days statement range
    return getLocalDateString(d);
  });
  const [statementTo, setStatementTo] = useState(() => getLocalDateString(new Date()));

  // Default daily rate fallback constant
  const DAILY_LEASE_RATE = 15000;

  // Query for rider statement payment logs in selected date range
  const statementQuery = useQuery({
    queryKey: ['rider-statement', statementRider?.id, statementFrom, statementTo],
    queryFn: () =>
      apiFetch<PaginatedResponse<RiderPaymentLog>>(
        `/financials${buildQueryString({
          riderId: statementRider?.id,
          startDate: `${statementFrom}T00:00:00.000Z`,
          endDate: `${statementTo}T23:59:59.999Z`,
          page: 1,
          pageSize: 100,
        })}`,
      ),
    enabled: !!statementRider && showStatementModal,
  });
  const statementPayments = useMemo(() => statementQuery.data?.data ?? [], [statementQuery.data]);

  const ridersQuery = useQuery({
    queryKey: ['riders', page, searchQuery],
    queryFn: () =>
      apiFetch<PaginatedResponse<Rider>>(
        `/riders${buildQueryString({
          page,
          pageSize: PAGE_SIZE,
          search: searchQuery.trim() || undefined,
        })}`,
      ),
  });

  // Reset page to 1 when search query changes to prevent blank pages
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useQuery({
    queryKey: ['assignments', 'riders-page'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Assignment>>('/assignments?page=1&pageSize=200&active=true'),
  });

  const riders = useMemo(() => ridersQuery.data?.data ?? [], [ridersQuery.data?.data]);
  const totalRiders = ridersQuery.data?.total ?? 0;

  const [accumulatedRiders, setAccumulatedRiders] = useState<Rider[]>([]);

  useEffect(() => {
    if (page === 1) {
      setAccumulatedRiders(riders);
    } else {
      setAccumulatedRiders((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newRiders = riders.filter((r) => !existingIds.has(r.id));
        return [...prev, ...newRiders];
      });
    }
  }, [riders, page]);

  const filteredRiders = accumulatedRiders;

  const activeCount = accumulatedRiders.filter((r) => r.status === 'ACTIVE').length;
  const suspendedCount = accumulatedRiders.filter((r) => r.status === 'SUSPENDED').length;
  const assignedCount = accumulatedRiders.filter(
    (r) => r.activeAssignments && r.activeAssignments.length > 0,
  ).length;

  const isDirectFormInvalid = useMemo(() => {
    if (!newFullName || !newPassword || newPassword.length < 8) return true;
    if (!newPhone && !newEmail) return true;
    if (!newLicenceNumber || !newIdentityNumber) return true;
    if (!newPassportPhoto || !newLicencePhoto || !newIdentityCardPhoto) return true;
    if (leaseToOwn) {
      if (!leasePrincipal || !leaseDailyRate) return true;
    }
    return false;
  }, [
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

  const handleCreateRider = async () => {
    setCreateError(null);
    if (!newFullName) {
      setCreateError(t('Full name is required.'));
      return;
    }
    if (!newPhone && !newEmail) {
      setCreateError(t('Phone or email is required.'));
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setCreateError(t('Password must be at least 8 characters.'));
      return;
    }
    if (!newLicenceNumber) {
      setCreateError(t('Licence number is required.'));
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
    }
    if (!leaseDailyRate || parseFloat(leaseDailyRate) <= 0) {
      setCreateError(t('Lease daily rate must be a positive number.'));
      return;
    }
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
          leaseToOwn,
          leasePrincipal: leaseToOwn ? Number(leasePrincipal) : undefined,
          leaseDailyRate: Number(leaseDailyRate),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
      setShowCreateForm(false);
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
        header: t('safety_score'),
        render: (rider) => {
          const score = rider.safetyScore ?? 100;
          let color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
          if (score < 70) {
            color = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
          } else if (score < 85) {
            color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
          }
          return (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border ${color}`}>
              <Shield size={12} />
              <span>{score}</span>
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
                  <label className="block text-sm font-medium text-ink">
                    {t("Payment Plan")}
                    <select
                      value={leaseToOwn ? 'lease' : 'collect'}
                      onChange={(e) => setLeaseToOwn(e.target.value === 'lease')}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                    >
                      <option value="collect">{t("Daily Collection")}</option>
                      <option value="lease">{t("Lease-to-Own")}</option>
                    </select>
                  </label>
                  {leaseToOwn && (
                    <label className="block text-sm font-medium text-ink">
                      {t("Lease Principal Amount (RWF)")}
                      <input
                        type="number"
                        value={leasePrincipal}
                        onChange={(e) => setLeasePrincipal(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                      />
                    </label>
                  )}
                  <label className="block text-sm font-medium text-ink">
                    {t("Lease Daily Rate (RWF)")}
                    <input
                      type="number"
                      value={leaseDailyRate}
                      onChange={(e) => setLeaseDailyRate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
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
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-accent-strong"
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
                  disabled={isCreating || isDirectFormInvalid}
                  onClick={() => void handleCreateRider()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#3B82F6', color: 'white' }}
                >
                  {isCreating ? t('Creating...') : t('Create rider')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isGeneratingInvite}
                  onClick={() => void handleGenerateInvite()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
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

        {accumulatedRiders.length < totalRiders && (
          <div className="flex flex-col items-center justify-center gap-3 mt-6 pt-6 border-t border-line">
            <div className="w-64 bg-line rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (accumulatedRiders.length / totalRiders) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-ink-muted">
              {t('Showing {loaded} of {total} riders')
                .replace('{loaded}', String(accumulatedRiders.length))
                .replace('{total}', String(totalRiders))}
            </p>
            <button
              type="button"
              disabled={ridersQuery.isFetching}
              onClick={() => setPage((prev) => prev + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ridersQuery.isFetching ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : (
                <ChevronDown size={16} className="animate-bounce" />
              )}
              {ridersQuery.isFetching ? t('Loading...') : t('Load more')}
            </button>
          </div>
        )}
        {accumulatedRiders.length >= totalRiders && totalRiders > 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 mt-6 pt-6 border-t border-line">
            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <Check size={14} /> {t('All {total} riders loaded').replace('{total}', String(totalRiders))}
            </p>
          </div>
        )}
      </DashboardCard>

      <Drawer
        open={!!selectedRider}
        title={isEditing ? t('Edit Rider Details') : (selectedRider?.fullName ?? t('Rider Profile'))}
        description={isEditing ? t("Modify rider profile information, document records, and payment settings.") : t("Rider contact information, active bike assignment, and onboarding documents.")}
        onClose={() => {
          setSelectedRider(null);
          setIsEditing(false);
          setEditError(null);
        }}
      >
        {!selectedRider ? null : (
          <div className="space-y-6">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-ink">
                    {t("Full name")}
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder={t("John Doe")}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Phone")}
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+254..."
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Email")}
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="rider@fleet.co"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Password (leave blank to keep current)")}
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder={t("At least 8 characters")}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Driving Licence Number")}
                    <input
                      type="text"
                      value={editLicenceNumber}
                      onChange={(e) => setEditLicenceNumber(e.target.value)}
                      placeholder="DL-..."
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Identity Card Number")}
                    <input
                      type="text"
                      value={editIdentityNumber}
                      onChange={(e) => setEditIdentityNumber(e.target.value)}
                      placeholder="ID-..."
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    {t("Payment Plan")}
                    <select
                      value={editLeaseToOwn ? 'lease' : 'collect'}
                      onChange={(e) => setEditLeaseToOwn(e.target.value === 'lease')}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                    >
                      <option value="collect">{t("Daily Collection")}</option>
                      <option value="lease">{t("Lease-to-Own")}</option>
                    </select>
                  </label>
                  {editLeaseToOwn && (
                    <label className="block text-sm font-medium text-ink">
                      {t("Lease Principal Amount (RWF)")}
                      <input
                        type="number"
                        value={editLeasePrincipal}
                        onChange={(e) => setEditLeasePrincipal(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                      />
                    </label>
                  )}
                  <label className="block text-sm font-medium text-ink">
                    {t("Lease Daily Rate (RWF)")}
                    <input
                      type="number"
                      value={editLeaseDailyRate}
                      onChange={(e) => setEditLeaseDailyRate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                    />
                  </label>
                </div>

                {/* Edit Photo Uploads */}
                <div className="grid gap-4 sm:grid-cols-3 mt-4">
                  {/* Passport Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("Passport Photo")}</label>
                    {editPassportPhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[100px]">
                        <img src={editPassportPhoto} alt={t("Passport")} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditPassportPhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-hover p-2 cursor-pointer hover:border-accent/30 transition h-[100px]">
                        <span className="text-lg mb-0.5">👤</span>
                        <span className="text-[9px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingEditPassport ? t('Compresing...') : t('Upload Passport')}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isCompresingEditPassport}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsCompresingEditPassport(true);
                                const compressed = await compressImage(file);
                                setEditPassportPhoto(compressed);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsCompresingEditPassport(false);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Licence Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("Licence Photo")}</label>
                    {editLicencePhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[100px]">
                        <img src={editLicencePhoto} alt={t("Licence")} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditLicencePhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-hover p-2 cursor-pointer hover:border-accent/30 transition h-[100px]">
                        <span className="text-lg mb-0.5">💳</span>
                        <span className="text-[9px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingEditLicence ? t('Compresing...') : t('Upload Licence')}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isCompresingEditLicence}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsCompresingEditLicence(true);
                                const compressed = await compressImage(file);
                                setEditLicencePhoto(compressed);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsCompresingEditLicence(false);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Identity Card Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("ID Card Photo")}</label>
                    {editIdentityCardPhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[100px]">
                        <img src={editIdentityCardPhoto} alt={t("ID Card")} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditIdentityCardPhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-hover p-2 cursor-pointer hover:border-accent/30 transition h-[100px]">
                        <span className="text-lg mb-0.5">📇</span>
                        <span className="text-[9px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingEditIdentity ? t('Compresing...') : t('Upload ID Card')}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isCompresingEditIdentity}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsCompresingEditIdentity(true);
                                const compressed = await compressImage(file);
                                setEditIdentityCardPhoto(compressed);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsCompresingEditIdentity(false);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {editError && (
                  <p className="mt-3 rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-2.5 text-sm text-danger-ink">
                    {editError}
                  </p>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditError(null);
                    }}
                    className="rounded-xl border border-line bg-surface-hover px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() => void handleUpdateRider()}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#3B82F6', color: 'white' }}
                  >
                    {updateMutation.isPending ? t('Saving...') : t('Save changes')}
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                  <KeyMetric
                    label={t("Payment Plan")}
                    value={
                      selectedRider.leaseToOwn ? (
                        <div>
                          <p className="font-semibold text-ink">{t('Lease-to-Own')}</p>
                          <p className="text-[10px] text-ink-muted mt-0.5">
                            {t('Principal')}: {selectedRider.leasePrincipal?.toLocaleString()} RWF | {t('Daily')}: {selectedRider.leaseDailyRate?.toLocaleString()} RWF
                          </p>
                        </div>
                      ) : (
                        t('Daily Collection')
                      )
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

                {/* Traffic Fines Section */}
                <div className="rounded-2xl border border-line bg-surface p-4 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t('Traffic Fines')}</h3>
                    <button
                      onClick={() => {
                        setFineRecordRiderId(selectedRider.id);
                        setFineRecordRiderName(selectedRider.fullName ?? '');
                        setShowRecordFineModal(true);
                      }}
                      className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Plus size={12} /> {t('Record Fine')}
                    </button>
                  </div>
                  {riderFines && riderFines.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {riderFines.map((fine: TrafficFine) => (
                        <div key={fine.id} className="flex items-center justify-between p-2.5 bg-surface-muted/50 rounded-xl border border-line/40 text-xs">
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-ink truncate max-w-[120px]">{fine.ticketNumber}</span>
                              <Badge
                                label={t(fine.status)}
                                tone={fine.status === 'PAID' ? 'success' : fine.status === 'CANCELLED' ? 'neutral' : 'warning'}
                              />
                            </div>
                            <p className="text-ink-muted truncate" title={fine.reason}>{fine.reason}</p>
                            <p className="text-[10px] text-ink-faint">{new Date(fine.finedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <p className="font-mono font-bold text-ink">{fine.amount.toLocaleString()} RWF</p>
                            {fine.status === 'PENDING' && (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => handlePayFine(fine.id)}
                                  className="text-[10px] font-bold text-success-ink hover:underline cursor-pointer"
                                >
                                  {t('Pay')}
                                </button>
                                <button
                                  onClick={() => handleCancelFine(fine.id)}
                                  className="text-[10px] font-bold text-zinc-500 hover:underline cursor-pointer"
                                >
                                  {t('Cancel')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-faint italic">{t('No traffic fines recorded for this rider.')}</p>
                  )}
                </div>

                {/* Quick Actions Panel */}
                <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3 mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t('Rider Management')}</h3>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={startEditing}
                      className="flex items-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface-hover transition-colors"
                    >
                      <UserPlus size={14} />
                      {t('Edit Details')}
                    </button>
                    {selectedRider.status === 'ACTIVE' ? (
                      <button
                        onClick={() => {
                          setStatusTargetId(selectedRider.id);
                          setStatusTargetName(selectedRider.fullName ?? 'Rider');
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
                            setStatusTargetName(selectedRider.fullName ?? 'Rider');
                            setStatusTargetNext('ACTIVE');
                            setStatusConfirmOpen(true);
                          }}
                          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-blue-500/15 cursor-pointer"
                        >
                          <UserRound size={14} />
                          {t('Reactivate Rider')}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => {
                        setStatementRider(selectedRider);
                        setShowStatementModal(true);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
                    >
                      <Coins size={14} />
                      {t('Financial Statement')}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTargetId(selectedRider.id);
                        setDeleteTargetName(selectedRider.fullName ?? 'Rider');
                        setDeleteConfirmOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-semibold text-danger-ink hover:bg-danger-soft transition-colors"
                    >
                      <Trash2 size={14} />
                      {t('Delete Profile')}
                    </button>
                  </div>
                </div>
              </>
            )}
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

      {showRecordFineModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-[4px]" onClick={() => setShowRecordFineModal(false)} />
          <div className="relative w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowRecordFineModal(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            >
              <X size={16} />
            </button>
            <h2 className="text-base font-bold text-ink mb-4">{t('Record Traffic Fine')}</h2>
            <p className="text-xs text-ink-muted mb-4">{t('Fining rider')}: <span className="font-semibold text-ink">{fineRecordRiderName}</span></p>

            <form onSubmit={handleRecordFine} className="space-y-4">
              {recordFineError && (
                <div className="rounded-xl border border-danger-ink/20 bg-danger-soft p-3 text-xs text-danger-ink">
                  {recordFineError}
                </div>
              )}
              <label className="block text-sm font-medium text-ink">
                {t('Ticket / Citation Number')}
                <input
                  type="text"
                  required
                  value={fineTicketNumber}
                  onChange={(e) => setFineTicketNumber(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                  placeholder="e.g. TKT-12345"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                {t('Fine Amount (RWF)')}
                <input
                  type="number"
                  required
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                  placeholder="e.g. 25000"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                {t('Violation Date')}
                <input
                  type="date"
                  required
                  value={fineDate}
                  onChange={(e) => setFineDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                {t('Reason / Description')}
                <textarea
                  required
                  rows={3}
                  value={fineReason}
                  onChange={(e) => setFineReason(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-hover px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent/50 resize-none"
                  placeholder={t('Describe the violation...')}
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecordFineModal(false)}
                  className="w-1/2 rounded-xl border border-line bg-surface py-2.5 text-sm font-semibold text-ink hover:bg-surface-hover transition-colors"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isRecordingFine}
                  className="w-1/2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/15 flex items-center justify-center transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isRecordingFine ? t('Recording...') : t('Record Fine')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rider Financial Statement Modal */}
      {showStatementModal && statementRider && (
        <div
          onClick={() => setShowStatementModal(false)}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-[4px] p-4 cursor-pointer animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-line bg-surface shadow-2xl animate-scale-in overflow-hidden cursor-default"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line p-5 shrink-0">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {t('Financial Statement')} &middot; {statementRider.fullName}
                </h3>
                <p className="text-xs text-ink-muted">
                  {statementRider.phone ?? statementRider.email ?? ''} &middot;{' '}
                  {statementRider.leaseToOwn ? t('Lease-to-Own Plan') : t('Daily Collection Plan')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStatementModal(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 dashboard-scrollbar">
              {/* Date Filter & Export Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-surface-muted/40 p-4 rounded-xl border border-line">
                <div className="flex-1">
                  <DateRangePicker
                    from={statementFrom}
                    to={statementTo}
                    onChange={({ from, to }) => {
                      setStatementFrom(from);
                      setStatementTo(to);
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={statementPayments.length === 0}
                  onClick={() => {
                    const totalPaid = statementPayments
                      .filter(p => p.status === 'PAID')
                      .reduce((sum, p) => sum + Number(p.amount), 0);
                    const totalArrears = statementPayments
                      .filter(p => p.status === 'OVERDUE' || p.status === 'UNPAID')
                      .reduce((sum, p) => sum + Number(p.amount), 0);
                    
                    const cols = [
                      { header: t('Date'), key: 'paidAt', type: 'text' as const },
                      { header: t('Amount (RWF)'), key: 'amount', type: 'currency' as const, align: 'right' as const },
                      { header: t('Payment Method'), key: 'method', type: 'text' as const },
                      { header: t('Status'), key: 'status', type: 'status' as const, align: 'center' as const },
                      { header: t('Reference Code'), key: 'reference', type: 'text' as const },
                      { header: t('Notes'), key: 'notes', type: 'text' as const },
                    ];

                    const rows = statementPayments.map(p => ({
                      paidAt: new Date(p.paidAt).toLocaleDateString(),
                      amount: Number(p.amount) || 0,
                      method: t(p.method.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())),
                      status: t(p.status),
                      reference: p.reference ?? '',
                      notes: p.notes ?? '',
                    }));

                    downloadFormattedExcel({
                      title: t('Rider Financial Statement'),
                      subtitle: `${statementRider.fullName} (${statementRider.phone ?? ''})`,
                      dateRange: `${statementFrom} to ${statementTo}`,
                      kpis: [
                        { label: t('Total Paid in Period'), value: `${totalPaid.toLocaleString()} RWF` },
                        { label: t('Outstanding Arrears'), value: `${totalArrears.toLocaleString()} RWF` },
                        { label: t('Plan Type'), value: statementRider.leaseToOwn ? t('Lease-to-Own') : t('Daily Collection') },
                      ],
                      columns: cols,
                      rows,
                      sheetName: 'Rider Statement',
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-muted hover:bg-surface-hover text-ink-soft hover:text-ink px-4 py-3 text-xs font-semibold disabled:opacity-50 h-fit"
                >
                  <Download size={14} />
                  {t('Download Statement')}
                </button>
              </div>

              {/* Summary KPIs */}
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{t('Total Paid')}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-emerald-500">
                    {statementPayments
                      .filter(p => p.status === 'PAID')
                      .reduce((sum, p) => sum + Number(p.amount), 0)
                      .toLocaleString()}{' '}
                    RWF
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{t('Pending Arrears')}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-rose-500">
                    {statementPayments
                      .filter(p => p.status === 'OVERDUE' || p.status === 'UNPAID')
                      .reduce((sum, p) => sum + Number(p.amount), 0)
                      .toLocaleString()}{' '}
                    RWF
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-surface-muted px-4 py-3 col-span-2 md:col-span-1">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{t('Daily Rate')}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-ink-soft">
                    {(statementRider.leaseDailyRate ?? DAILY_LEASE_RATE).toLocaleString()} RWF
                  </p>
                </div>
              </div>

              {/* Buy-to-Own Equity Progress */}
              {statementRider.leaseToOwn && (
                <div className="rounded-xl border border-line bg-surface-muted p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-ink-soft">{t('Asset Ownership Equity Milestone')}</span>
                    <span className="font-bold text-accent">
                      {(() => {
                        const totalPaid = statementPayments
                          .filter(p => p.status === 'PAID')
                          .reduce((sum, p) => sum + Number(p.amount), 0);
                        const principal = statementRider.leasePrincipal ?? 2500000;
                        const pct = Math.min(100, Math.max(0, Math.round((totalPaid / principal) * 100)));
                        return `${pct}% (${totalPaid.toLocaleString()} / ${principal.toLocaleString()} RWF)`;
                      })()}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-line">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${(() => {
                          const totalPaid = statementPayments
                            .filter(p => p.status === 'PAID')
                            .reduce((sum, p) => sum + Number(p.amount), 0);
                          const principal = statementRider.leasePrincipal ?? 2500000;
                          return Math.min(100, Math.max(0, Math.round((totalPaid / principal) * 100)));
                        })()}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Transactions Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t('Timeline Transaction History')}</h4>
                {statementQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : statementPayments.length === 0 ? (
                  <EmptyState
                    icon={<Coins size={18} />}
                    title={t('No transactions in period')}
                    description={t('Choose a different date range or presets to check logs.')}
                  />
                ) : (
                  <div className="border border-line rounded-xl overflow-hidden bg-surface-muted/30">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-line bg-surface-muted text-ink-faint">
                          <th className="p-3 font-bold">{t('Date')}</th>
                          <th className="p-3 font-bold text-right">{t('Amount')}</th>
                          <th className="p-3 font-bold">{t('Method')}</th>
                          <th className="p-3 font-bold text-center">{t('Status')}</th>
                          <th className="p-3 font-bold">{t('Reference')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementPayments.map(p => (
                          <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                            <td className="p-3 font-semibold text-ink-soft">{new Date(p.paidAt).toLocaleDateString()}</td>
                            <td className="p-3 font-mono font-bold text-right text-ink">{Number(p.amount).toLocaleString()} RWF</td>
                            <td className="p-3 text-ink-muted">
                              {t(p.method.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()))}
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                label={t(p.status)}
                                tone={
                                  p.status === 'PAID'
                                    ? 'success'
                                    : p.status === 'PARTIAL'
                                      ? 'warning'
                                      : p.status === 'OVERDUE'
                                        ? 'danger'
                                        : 'neutral'
                                }
                              />
                            </td>
                            <td className="p-3 font-mono text-ink-faint">{p.reference ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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

