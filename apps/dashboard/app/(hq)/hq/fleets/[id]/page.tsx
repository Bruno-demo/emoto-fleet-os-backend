'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api/client';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  ArrowLeft,
  Bike as BikeIcon,
  User as UserIcon,
  Shield,
  Zap,
  Calendar,
  MapPin,
  Activity,
  TrendingUp,
  Users,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
  Loader2,
  Plus,
  Edit,
  Link2,
  Unlink,
  UserPlus,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import { Drawer } from '@/components/ui/drawer';
import { compressImage } from '@/lib/image';

const fleetDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  plan: z.string(),
  subscriptionStatus: z.string(),
  createdAt: z.string(),
  bikeRange: z.string().nullable().optional(),
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      role: z.string(),
      status: z.string(),
      riderProfile: z
        .object({
          fullName: z.string(),
          licenceNumber: z.string().nullable().optional(),
          identityNumber: z.string().nullable().optional(),
          passportPhoto: z.string().nullable().optional(),
          licencePhoto: z.string().nullable().optional(),
          identityCardPhoto: z.string().nullable().optional(),
          leaseToOwn: z.boolean().optional(),
          leasePrincipal: z.number().optional(),
          leaseDailyRate: z.number().optional()
        })
        .nullable()
        .optional()
    })
  ),
  bikes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      plate: z.string().nullable(),
      serial: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      status: z.string(),
      type: z.string().nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      leaseToOwn: z.boolean().optional(),
      devices: z
        .array(
          z.object({
            id: z.string(),
            deviceUid: z.string()
          })
        )
        .optional()
    })
  ),
  _count: z.object({
    users: z.number(),
    bikes: z.number(),
    events: z.number(),
    trips: z.number(),
    devices: z.number().optional(),
    incidents: z.number().optional()
  })
});

const unassignedDevicesSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      deviceUid: z.string(),
      imei: z.string().nullable()
    })
  ),
  total: z.number()
});

type FleetDetail = z.infer<typeof fleetDetailSchema>;
type FleetUser = FleetDetail['users'][number];
type FleetBike = FleetDetail['bikes'][number];

export default function FleetDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: fleet, isLoading } = useQuery({
    queryKey: ['hq', 'fleet', id],
    queryFn: () => apiFetch(`/hq/fleets/${id}`, {}, { schema: fleetDetailSchema }),
    enabled: !!id
  });

  const { data: availableDevices } = useQuery({
    queryKey: ['hq', 'unassigned-devices'],
    queryFn: () => apiFetch('/hq/devices?assigned=false', {}, { schema: unassignedDevicesSchema })
  });

  // ── Fleet Level Mutations ──────────────────────────────────────────

  const planMutation = useMutation({
    mutationFn: (plan: string) =>
      apiFetch(
        `/hq/fleets/${id}/plan`,
        {
          method: 'PUT',
          body: JSON.stringify({ plan }),
          headers: { 'Content-Type': 'application/json' }
        }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] })
  });

  const typeMutation = useMutation({
    mutationFn: (type: string) =>
      apiFetch(
        `/hq/fleets/${id}/type`,
        {
          method: 'PUT',
          body: JSON.stringify({ type }),
          headers: { 'Content-Type': 'application/json' }
        }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] })
  });

  const subMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch(
        `/hq/fleets/${id}/subscription`,
        {
          method: 'PUT',
          body: JSON.stringify({ status }),
          headers: { 'Content-Type': 'application/json' }
        }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] })
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/hq/fleets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq'] });
      router.push('/hq/fleets');
    }
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => apiFetch(`/hq/fleets/${id}/permanent`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq'] });
      router.push('/hq/fleets');
    }
  });

  // ── Bike Mutations ──────────────────────────────────────────────────

  const bikeStatusMutation = useMutation({
    mutationFn: ({ bikeId, status }: { bikeId: string; status: string }) =>
      apiFetch(`/hq/bikes/${bikeId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] })
  });

  const createBikeMutation = useMutation({
    mutationFn: (body: {
      label: string;
      plate?: string;
      serial?: string;
      model?: string;
      status: string;
      leaseToOwn?: boolean;
    }) =>
      apiFetch(`/hq/fleets/${id}/bikes`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] });
      setIsBikeModalOpen(false);
      resetBikeForm();
    }
  });

  const updateBikeMutation = useMutation({
    mutationFn: ({
      bikeId,
      ...body
    }: {
      bikeId: string;
      label: string;
      plate?: string;
      serial?: string;
      model?: string;
      status: string;
      leaseToOwn?: boolean;
    }) =>
      apiFetch(`/hq/bikes/${bikeId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] });
      setIsBikeModalOpen(false);
      resetBikeForm();
    }
  });

  const deleteBikeMutation = useMutation({
    mutationFn: (bikeId: string) =>
      apiFetch(`/hq/bikes/${bikeId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] })
  });

  // ── User Mutations ──────────────────────────────────────────────────

  const createUserMutation = useMutation({
    mutationFn: (body: {
      email?: string;
      phone?: string;
      role: string;
      status: string;
      password?: string;
      fullName: string;
      passportPhoto?: string;
      licenceNumber?: string;
      identityNumber?: string;
      licencePhoto?: string;
      identityCardPhoto?: string;
      leaseToOwn?: boolean;
      leasePrincipal?: number;
      leaseDailyRate?: number;
    }) =>
      apiFetch(`/hq/fleets/${id}/users`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] });
      setIsUserModalOpen(false);
      resetUserForm();
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      ...body
    }: {
      userId: string;
      email?: string;
      phone?: string;
      role: string;
      status: string;
      fullName: string;
      passportPhoto?: string;
      licenceNumber?: string;
      identityNumber?: string;
      licencePhoto?: string;
      identityCardPhoto?: string;
      leaseToOwn?: boolean;
      leasePrincipal?: number;
      leaseDailyRate?: number;
    }) =>
      apiFetch(`/hq/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] });
      setIsUserModalOpen(false);
      resetUserForm();
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/hq/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] })
  });

  // ── Device Assignment Mutations ──────────────────────────────────────

  const assignDeviceMutation = useMutation({
    mutationFn: ({ deviceId, bikeId }: { deviceId: string; bikeId: string }) =>
      apiFetch(`/hq/devices/${deviceId}/assign-bike`, {
        method: 'POST',
        body: JSON.stringify({ bikeId }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'unassigned-devices'] });
      setIsDeviceModalOpen(false);
    }
  });

  const unassignDeviceMutation = useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(`/hq/devices/${deviceId}/unassign-bike`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'unassigned-devices'] });
    }
  });

  const [lockingBikeId, setLockingBikeId] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockSuccess, setLockSuccess] = useState<string | null>(null);

  const lockMutation = useMutation({
    mutationFn: ({ bikeId, action }: { bikeId: string; action: 'lock' | 'unlock' }) =>
      apiFetch(`/hq/bikes/${bikeId}/${action}`, { method: 'POST' }),
    onMutate: ({ bikeId }) => {
      setLockingBikeId(bikeId);
      setLockError(null);
      setLockSuccess(null);
    },
    onSuccess: (_data, { action, bikeId }) => {
      const bike = fleet?.bikes.find((b) => b.id === bikeId);
      setLockSuccess(
        `${action === 'lock' ? 'Lock' : 'Unlock'} command sent to ${
          bike?.label ?? 'bike'
        }`
      );
      setLockingBikeId(null);
      setTimeout(() => setLockSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setLockingBikeId(null);
      if (err instanceof ApiError) {
        setLockError(err.message);
      } else {
        setLockError('Command failed');
      }
      setTimeout(() => setLockError(null), 5000);
    }
  });

  // ── UI States ──────────────────────────────────────────────────────

  const [isBikeModalOpen, setIsBikeModalOpen] = useState(false);
  const [bikeEditMode, setBikeEditMode] = useState(false);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [bikeLabel, setBikeLabel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [bikeSerial, setBikeSerial] = useState('');
  const [bikeModel, setBikeModel] = useState('');
  const [bikeStatus, setBikeStatus] = useState('ACTIVE');
  const [bikeType, setBikeType] = useState('SPIRO');
  const [bikeImageUrl, setBikeImageUrl] = useState('');
  const [bikeLeaseToOwn, setBikeLeaseToOwn] = useState(false);
  const [isCompresingBike, setIsCompresingBike] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userEditMode, setUserEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userRole, setUserRole] = useState('RIDER');
  const [userStatus, setUserStatus] = useState('ACTIVE');
  const [userPassword, setUserPassword] = useState('');
  const [userLicenceNumber, setUserLicenceNumber] = useState('');
  const [userIdentityNumber, setUserIdentityNumber] = useState('');
  const [userPassportPhoto, setUserPassportPhoto] = useState('');
  const [userLicencePhoto, setUserLicencePhoto] = useState('');
  const [userIdentityCardPhoto, setUserIdentityCardPhoto] = useState('');
  const [userLeaseToOwn, setUserLeaseToOwn] = useState(false);
  const [userLeasePrincipal, setUserLeasePrincipal] = useState('2500000');
  const [userLeaseDailyRate, setUserLeaseDailyRate] = useState('15000');
  const [isCompresingPassport, setIsCompresingPassport] = useState(false);
  const [isCompresingLicence, setIsCompresingLicence] = useState(false);
  const [isCompresingIdCard, setIsCompresingIdCard] = useState(false);

  const [selectedOperator, setSelectedOperator] = useState<FleetUser | null>(null);
  const [isOperatorDrawerOpen, setIsOperatorDrawerOpen] = useState(false);

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceBikeId, setDeviceBikeId] = useState<string | null>(null);
  const [deviceSelectedId, setDeviceSelectedId] = useState('');

  const resetBikeForm = () => {
    setBikeLabel('');
    setBikePlate('');
    setBikeSerial('');
    setBikeModel('');
    setBikeStatus('ACTIVE');
    setBikeType('SPIRO');
    setBikeImageUrl('');
    setBikeLeaseToOwn(false);
    setSelectedBikeId(null);
  };

  const resetUserForm = () => {
    setUserFullName('');
    setUserEmail('');
    setUserPhone('');
    setUserRole('RIDER');
    setUserStatus('ACTIVE');
    setUserPassword('');
    setUserLicenceNumber('');
    setUserIdentityNumber('');
    setUserPassportPhoto('');
    setUserLicencePhoto('');
    setUserIdentityCardPhoto('');
    setUserLeaseToOwn(false);
    setUserLeasePrincipal('2500000');
    setUserLeaseDailyRate('15000');
    setSelectedUserId(null);
  };

  const openCreateBikeModal = () => {
    resetBikeForm();
    setBikeEditMode(false);
    setIsBikeModalOpen(true);
  };

  const openEditBikeModal = (bike: FleetBike) => {
    setSelectedBikeId(bike.id);
    setBikeLabel(bike.label);
    setBikePlate(bike.plate || '');
    setBikeSerial(bike.serial || '');
    setBikeModel(bike.model || '');
    setBikeStatus(bike.status);
    setBikeType(bike.type || 'SPIRO');
    setBikeImageUrl(bike.imageUrl || '');
    setBikeLeaseToOwn(bike.leaseToOwn ?? false);
    setBikeEditMode(true);
    setIsBikeModalOpen(true);
  };

  const openCreateUserModal = () => {
    resetUserForm();
    setUserEditMode(false);
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: FleetUser) => {
    setSelectedUserId(user.id);
    setUserFullName(user.riderProfile?.fullName || '');
    setUserEmail(user.email || '');
    setUserPhone(user.phone || '');
    setUserRole(user.role);
    setUserStatus(user.status);
    setUserPassword('');
    setUserLicenceNumber(user.riderProfile?.licenceNumber || '');
    setUserIdentityNumber(user.riderProfile?.identityNumber || '');
    setUserPassportPhoto(user.riderProfile?.passportPhoto || '');
    setUserLicencePhoto(user.riderProfile?.licencePhoto || '');
    setUserIdentityCardPhoto(user.riderProfile?.identityCardPhoto || '');
    setUserLeaseToOwn(user.riderProfile?.leaseToOwn ?? false);
    setUserLeasePrincipal(String(user.riderProfile?.leasePrincipal ?? 2500000));
    setUserLeaseDailyRate(String(user.riderProfile?.leaseDailyRate ?? 15000));
    setUserEditMode(true);
    setIsUserModalOpen(true);
  };

  const handleBikeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      label: bikeLabel,
      plate: bikePlate || undefined,
      serial: bikeSerial || undefined,
      model: bikeModel || undefined,
      status: bikeStatus,
      type: bikeType || undefined,
      imageUrl: bikeImageUrl || undefined,
      leaseToOwn: bikeLeaseToOwn,
    };

    if (bikeEditMode && selectedBikeId) {
      updateBikeMutation.mutate({ bikeId: selectedBikeId, ...payload });
    } else {
      createBikeMutation.mutate(payload);
    }
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      email: userEmail || undefined,
      phone: userPhone || undefined,
      role: userRole,
      status: userStatus,
      fullName: userFullName,
      licenceNumber: userLicenceNumber || undefined,
      identityNumber: userIdentityNumber || undefined,
      passportPhoto: userPassportPhoto || undefined,
      licencePhoto: userLicencePhoto || undefined,
      identityCardPhoto: userIdentityCardPhoto || undefined,
      leaseToOwn: userRole === 'RIDER' ? userLeaseToOwn : undefined,
      leasePrincipal: userRole === 'RIDER' && userLeaseToOwn ? Number(userLeasePrincipal) : undefined,
      leaseDailyRate: userRole === 'RIDER' && userLeaseToOwn ? Number(userLeaseDailyRate) : undefined,
    };

    if (userEditMode && selectedUserId) {
      updateUserMutation.mutate({ userId: selectedUserId, ...payload });
    } else {
      createUserMutation.mutate({ ...payload, password: userPassword });
    }
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (deviceBikeId && deviceSelectedId) {
      assignDeviceMutation.mutate({ deviceId: deviceSelectedId, bikeId: deviceBikeId });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-white/5 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-4 w-96 rounded-lg bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!fleet) {
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
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
              Fleet Not Found
            </h1>
          </div>
        </div>
      </div>
    );
  }

  const activeUsersCount = fleet.users.filter((u) => u.status === 'ACTIVE').length;
  const activeBikesCount = fleet.bikes.filter((b) => b.status === 'ACTIVE').length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight text-white">
                {fleet.name}
              </h1>
              {fleet.bikeRange && (
                <span className="inline-flex items-center rounded-lg bg-accent/15 border border-accent/30 px-2.5 py-0.5 text-xs font-bold text-accent">
                  Expected size: {fleet.bikeRange}
                </span>
              )}
            </div>
            <p className="mt-1 text-zinc-400">
              Detailed analytics and configuration for {fleet.type} fleet
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Active Users
              </p>
              <p className="mt-2 text-3xl font-bold text-white">{activeUsersCount}</p>
              <p className="mt-1 text-xs text-zinc-600">of {fleet._count.users} total</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Active Bikes
              </p>
              <p className="mt-2 text-3xl font-bold text-white">{activeBikesCount}</p>
              <p className="mt-1 text-xs text-zinc-600">of {fleet._count.bikes} total</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <BikeIcon size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Plan</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {fleet.plan === 'PREMIUM'
                  ? 'Operations Plus'
                  : fleet.plan === 'DEMO'
                  ? 'Safety Core'
                  : fleet.plan === 'INSURANCE'
                  ? 'Insurance'
                  : fleet.plan}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Subscription {fleet.subscriptionStatus}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Recorded Events
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {fleet._count.events.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-zinc-600">{fleet._count.trips} trips</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <Activity size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Management Actions */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-6">
          <Shield size={18} className="text-zinc-400" />
          Fleet Management
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Fleet Type */}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
              Fleet Type
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => typeMutation.mutate('COOP')}
                disabled={typeMutation.isPending || fleet.type === 'COOP'}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  fleet.type === 'COOP'
                    ? 'bg-accent text-white'
                    : 'border border-line bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                COOP
              </button>
              <button
                onClick={() => typeMutation.mutate('DELIVERY')}
                disabled={typeMutation.isPending || fleet.type === 'DELIVERY'}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  fleet.type === 'DELIVERY'
                    ? 'bg-accent text-white'
                    : 'border border-line bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                DELIVERY
              </button>
            </div>
          </div>

          {/* Plan Change */}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
              Service Plan
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => planMutation.mutate('DEMO')}
                disabled={planMutation.isPending || fleet.plan === 'DEMO'}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  fleet.plan === 'DEMO'
                    ? 'bg-accent text-white'
                    : 'border border-line bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                Safety Core
              </button>
              <button
                onClick={() => planMutation.mutate('PREMIUM')}
                disabled={planMutation.isPending || fleet.plan === 'PREMIUM'}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  fleet.plan === 'PREMIUM'
                    ? 'bg-accent text-white'
                    : 'border border-line bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                Operations Plus
              </button>
            </div>
          </div>

          {/* Subscription Status */}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
              Subscription
            </p>
            <select
              value={fleet.subscriptionStatus}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'PERMANENT_DELETE') {
                  if (
                    confirm(
                      `Permanently delete fleet "${fleet.name}"? This action CANNOT be undone and will delete all users, bikes, devices, and historical data associated with it.`
                    )
                  ) {
                    permanentDeleteMutation.mutate();
                  }
                } else {
                  subMutation.mutate(val);
                }
              }}
              disabled={subMutation.isPending || permanentDeleteMutation.isPending}
              className="w-full rounded-xl border border-line bg-surface-strong px-3 py-2.5 text-xs font-bold text-ink-soft focus:border-accent focus:outline-none cursor-pointer"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELED">CANCELED</option>
              <option value="PERMANENT_DELETE" className="text-rose-400 bg-rose-950/20">PERMANENT_DELETE</option>
            </select>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-3">
              Danger Zone
            </p>
            <button
              onClick={() => {
                if (
                  confirm(
                    `Disable fleet "${fleet.name}"? All users will be set to DISABLED and bikes to RETIRED. This is a soft-delete.`
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/25 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleteMutation.isPending ? 'Disabling…' : 'Disable Fleet'}
            </button>
          </div>
        </div>
      </div>

      {/* Users Section */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Users size={18} className="text-zinc-400" />
            Fleet Operators ({fleet.users.length})
          </h2>
          <button
            onClick={openCreateUserModal}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95"
          >
            <UserPlus size={14} />
            Add Operator
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Role
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {fleet.users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => {
                    if (user.role === 'RIDER') {
                      setSelectedOperator(user);
                      setIsOperatorDrawerOpen(true);
                    }
                  }}
                  className={`hover:bg-white/[0.02] transition-colors ${
                    user.role === 'RIDER' ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-white">
                    <div className="flex items-center gap-3">
                      {user.riderProfile?.passportPhoto ? (
                        <img
                          src={user.riderProfile.passportPhoto}
                          alt={user.riderProfile.fullName ?? 'Operator'}
                          className="h-9 w-9 rounded-xl object-cover border border-line shrink-0"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent text-sm font-bold shrink-0">
                          {user.riderProfile?.fullName
                            ? user.riderProfile.fullName[0].toUpperCase()
                            : (user.email || user.phone || '?')[0].toUpperCase()}
                        </span>
                      )}
                      <span className="font-semibold">
                        {user.riderProfile?.fullName || user.email || user.phone || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {user.email && <div>{user.email}</div>}
                    {user.phone && <div>{user.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditUserModal(user);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 hover:text-white transition-all hover:bg-white/10"
                        title="Edit User"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Permanently delete operator "${user.email || user.phone}"?`)) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 transition-all hover:bg-rose-500/15 hover:border-rose-500/40"
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bikes Section */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <BikeIcon size={18} className="text-zinc-400" />
            Fleet Nodes ({fleet.bikes.length})
          </h2>
          <button
            onClick={openCreateBikeModal}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95"
          >
            <Plus size={14} />
            Add Bike
          </button>
        </div>

        {lockError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2.5">
            <span className="text-xs font-semibold text-rose-400">{lockError}</span>
          </div>
        )}
        {lockSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
            <span className="text-xs font-semibold text-emerald-400">{lockSuccess}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Label
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Details
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Assigned Device
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {fleet.bikes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No bikes assigned to this fleet
                  </td>
                </tr>
              ) : (
                fleet.bikes.map((bike) => {
                  const assignedDevice = bike.devices?.[0];
                  return (
                    <tr key={bike.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{bike.label}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400 space-y-0.5">
                        {bike.plate && <div>Plate: {bike.plate}</div>}
                        {bike.serial && <div>Serial: {bike.serial}</div>}
                        {bike.model && <div>Model: {bike.model}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {assignedDevice ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-emerald-400">
                              {assignedDevice.deviceUid}
                            </span>
                            <button
                              onClick={() => {
                                if (confirm(`Unassign device ${assignedDevice.deviceUid}?`)) {
                                  unassignDeviceMutation.mutate(assignedDevice.id);
                                }
                              }}
                              className="text-rose-400 hover:text-rose-300 transition-colors"
                              title="Unassign Device"
                            >
                              <Unlink size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setDeviceBikeId(bike.id);
                              setDeviceSelectedId('');
                              setIsDeviceModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-accent hover:underline font-semibold"
                          >
                            <Link2 size={12} />
                            Link Device
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <select
                          value={bike.status}
                          onChange={(e) =>
                            bikeStatusMutation.mutate({ bikeId: bike.id, status: e.target.value })
                          }
                          disabled={bikeStatusMutation.isPending}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold focus:outline-none cursor-pointer transition-all disabled:opacity-50 ${
                            bike.status === 'ACTIVE'
                              ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'
                              : bike.status === 'MAINTENANCE'
                              ? 'border-amber-500/30 text-amber-300 bg-amber-500/5'
                              : 'border-zinc-500/30 text-zinc-400 bg-zinc-500/5'
                          }`}
                        >
                          <option value="ACTIVE" className="bg-zinc-950 text-white">
                            ACTIVE
                          </option>
                          <option value="MAINTENANCE" className="bg-zinc-950 text-white">
                            MAINTENANCE
                          </option>
                          <option value="RETIRED" className="bg-zinc-950 text-white">
                            RETIRED
                          </option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {}}
                            disabled={true}
                            title="Lock bike (Coming Soon)"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition-all hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Lock size={14} />
                          </button>
                          <button
                            onClick={() =>
                              lockMutation.mutate({ bikeId: bike.id, action: 'unlock' })
                            }
                            disabled={
                              lockingBikeId === bike.id ||
                              bike.status !== 'ACTIVE' ||
                              ((bike as unknown) as { lockState?: string }).lockState === 'UNLOCKED' ||
                              ((bike as unknown) as { lockState?: string }).lockState === 'UNLOCKING'
                            }
                            title="Unlock bike"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-all hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {lockingBikeId === bike.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Unlock size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => openEditBikeModal(bike)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 hover:text-white transition-all hover:bg-white/10"
                            title="Edit Details"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Permanently delete bike "${bike.label}"?`)) {
                                deleteBikeMutation.mutate(bike.id);
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 transition-all hover:bg-rose-500/15 hover:border-rose-500/40"
                            title="Delete Bike"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-line px-4 py-3">
        <Calendar size={14} className="text-zinc-500" />
        <span className="text-xs text-zinc-400">
          Fleet created on {new Date(fleet.createdAt).toLocaleDateString()} at{' '}
          {new Date(fleet.createdAt).toLocaleTimeString()}
        </span>
      </div>

      {/* ── BIKE MODAL ── */}
      {isBikeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface-strong p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {bikeEditMode ? 'Edit Bike Details' : 'Register New Bike'}
              </h3>
              <button
                onClick={() => setIsBikeModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleBikeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Label
                </label>
                <input
                  type="text"
                  required
                  value={bikeLabel}
                  onChange={(e) => setBikeLabel(e.target.value)}
                  placeholder="e.g. Bike-010"
                  className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Plate
                  </label>
                  <input
                    type="text"
                    value={bikePlate}
                    onChange={(e) => setBikePlate(e.target.value)}
                    placeholder="e.g. RAB123C"
                    className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Model
                  </label>
                  <input
                    type="text"
                    value={bikeModel}
                    onChange={(e) => setBikeModel(e.target.value)}
                    placeholder="e.g. eMoto-X2"
                    className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={bikeSerial}
                  onChange={(e) => setBikeSerial(e.target.value)}
                  placeholder="e.g. SER-000010"
                  className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Status
                </label>
                <select
                  value={bikeStatus}
                  onChange={(e) => setBikeStatus(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="RETIRED">RETIRED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Bike Type
                </label>
                <select
                  value={bikeType}
                  onChange={(e) => setBikeType(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                >
                  <option value="SPIRO">SPIRO</option>
                  <option value="AMPARSAND">AMPARSAND</option>
                  <option value="AMAZI">AMAZI</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 cursor-pointer col-span-2">
                  <input
                    type="checkbox"
                    checked={bikeLeaseToOwn}
                    onChange={(e) => setBikeLeaseToOwn(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-accent focus:ring-accent"
                  />
                  <span>Lease-to-Own Plan Eligible</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Bike Image
                </label>
                {bikeImageUrl ? (
                  <div className="relative group rounded-xl border border-line overflow-hidden h-[120px]">
                    <img src={bikeImageUrl} alt="Bike" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setBikeImageUrl('')}
                      className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/5 p-4 cursor-pointer hover:border-accent/30 transition h-[120px]">
                    <span className="text-xl mb-1">🏍️</span>
                    <span className="text-[10px] font-semibold text-zinc-400 text-center leading-tight">
                      {isCompresingBike ? 'Compressing...' : 'Upload Bike Image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isCompresingBike}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setIsCompresingBike(true);
                            const compressed = await compressImage(file);
                            setBikeImageUrl(compressed);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsCompresingBike(false);
                          }
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsBikeModalOpen(false)}
                  className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBikeMutation.isPending || updateBikeMutation.isPending}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {createBikeMutation.isPending || updateBikeMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : bikeEditMode ? (
                    'Save Changes'
                  ) : (
                    'Register Bike'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── USER MODAL ── */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface-strong p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {userEditMode ? 'Edit Operator details' : 'Register Operator Account'}
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="+250..."
                    className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {!userEditMode && (
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Account Password
                  </label>
                  <input
                    type="password"
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Role
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                  >
                    <option value="RIDER">RIDER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="DISPATCHER">DISPATCHER</option>
                    <option value="TECH">TECH</option>
                    <option value="INSURER">INSURER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Status
                  </label>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING_SETUP">PENDING_SETUP</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              {/* Profile Image — available for ALL roles */}
              <div className="space-y-2 pt-4 border-t border-line">
                <h4 className="text-xs font-bold text-accent uppercase tracking-wider">
                  Profile Image
                </h4>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Photo
                  </label>
                  {userPassportPhoto ? (
                    <div className="relative group rounded-xl border border-line overflow-hidden h-[100px] w-[100px]">
                      <img src={userPassportPhoto} alt="Profile" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setUserPassportPhoto('')}
                        className="absolute top-1 right-1 rounded bg-black/60 p-0.5 text-white hover:bg-black/80 transition"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/5 p-3 cursor-pointer hover:border-accent/30 transition h-[100px] w-[100px]">
                      <span className="text-2xl">👤</span>
                      <span className="text-[9px] font-semibold text-zinc-400 text-center leading-tight mt-1">
                        {isCompresingPassport ? 'Compressing...' : 'Upload Photo'}
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
                              setUserPassportPhoto(compressed);
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
              </div>

              {/* Rider-specific documents */}
              {userRole === 'RIDER' && (
                <div className="space-y-4 pt-4 border-t border-line">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-wider">
                    Rider Documents & Plan
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                        Payment Plan
                      </label>
                      <select
                        value={userLeaseToOwn ? 'lease' : 'collect'}
                        onChange={(e) => setUserLeaseToOwn(e.target.value === 'lease')}
                        className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                      >
                        <option value="collect">Daily Collection</option>
                        <option value="lease">Lease-to-Own</option>
                      </select>
                    </div>
                  </div>

                  {userLeaseToOwn && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                          Lease Principal (RWF)
                        </label>
                        <input
                          type="number"
                          value={userLeasePrincipal}
                          onChange={(e) => setUserLeasePrincipal(e.target.value)}
                          className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                          Lease Daily Rate (RWF)
                        </label>
                        <input
                          type="number"
                          value={userLeaseDailyRate}
                          onChange={(e) => setUserLeaseDailyRate(e.target.value)}
                          className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                        Licence Number
                      </label>
                      <input
                        type="text"
                        value={userLicenceNumber}
                        onChange={(e) => setUserLicenceNumber(e.target.value)}
                        placeholder="e.g. B12345"
                        className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                        National ID Number
                      </label>
                      <input
                        type="text"
                        value={userIdentityNumber}
                        onChange={(e) => setUserIdentityNumber(e.target.value)}
                        placeholder="e.g. 1199..."
                        className="w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Licence Photo */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 text-center">
                        Licence Photo
                      </label>
                      {userLicencePhoto ? (
                        <div className="relative group rounded-xl border border-line overflow-hidden h-[80px]">
                          <img src={userLicencePhoto} alt="Licence" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setUserLicencePhoto('')}
                            className="absolute top-1 right-1 rounded bg-black/60 p-0.5 text-white hover:bg-black/80 transition"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/5 p-2 cursor-pointer hover:border-accent/30 transition h-[80px]">
                          <span className="text-lg">🪪</span>
                          <span className="text-[8px] font-semibold text-zinc-400 text-center leading-tight">
                            {isCompresingLicence ? 'Comp...' : 'Upload'}
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
                                  setUserLicencePhoto(compressed);
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
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 text-center">
                        National ID
                      </label>
                      {userIdentityCardPhoto ? (
                        <div className="relative group rounded-xl border border-line overflow-hidden h-[80px]">
                          <img src={userIdentityCardPhoto} alt="ID Card" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setUserIdentityCardPhoto('')}
                            className="absolute top-1 right-1 rounded bg-black/60 p-0.5 text-white hover:bg-black/80 transition"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/5 p-2 cursor-pointer hover:border-accent/30 transition h-[80px]">
                          <span className="text-lg">📇</span>
                          <span className="text-[8px] font-semibold text-zinc-400 text-center leading-tight">
                            {isCompresingIdCard ? 'Comp...' : 'Upload'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isCompresingIdCard}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsCompresingIdCard(true);
                                  const compressed = await compressImage(file);
                                  setUserIdentityCardPhoto(compressed);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setIsCompresingIdCard(false);
                                }
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {createUserMutation.isPending || updateUserMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : userEditMode ? (
                    'Save Changes'
                  ) : (
                    'Register Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DEVICE ASSIGNMENT MODAL ── */}
      {isDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface-strong p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Link Device to Bike Node</h3>
              <button
                onClick={() => setIsDeviceModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleDeviceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Select Unassigned Device
                </label>
                <select
                  required
                  value={deviceSelectedId}
                  onChange={(e) => setDeviceSelectedId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                >
                  <option value="">-- Choose Available Device --</option>
                  {availableDevices?.data.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.deviceUid} {dev.imei ? `(IMEI: ${dev.imei})` : ''}
                    </option>
                  ))}
                </select>
                {availableDevices?.total === 0 && (
                  <p className="mt-2 text-xs text-amber-400">
                    No unassigned devices currently active in system. Go to global Devices list to provision one first.
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignDeviceMutation.isPending || !deviceSelectedId}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {assignDeviceMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : (
                    'Link Hardware'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── OPERATOR DETAIL DRAWER ── */}
      <Drawer
        open={isOperatorDrawerOpen}
        title={selectedOperator?.riderProfile?.fullName ?? 'Operator Profile'}
        description="Operator contact information, role permissions, and onboarding documents."
        onClose={() => {
          setIsOperatorDrawerOpen(false);
          setSelectedOperator(null);
        }}
      >
        {!selectedOperator ? null : (
          <div className="space-y-6">
            {/* Passport Photo */}
            <div className="flex justify-center">
              {selectedOperator.riderProfile?.passportPhoto ? (
                <div className="relative rounded-2xl border border-line overflow-hidden w-28 h-28">
                  <img
                    src={selectedOperator.riderProfile.passportPhoto}
                    alt={selectedOperator.riderProfile.fullName ?? 'Passport'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-line bg-white/5 w-28 h-28 text-3xl">
                  👤
                </div>
              )}
            </div>

            {/* Profile Grid */}
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Full Name
                </p>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedOperator.riderProfile?.fullName ?? '—'}
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Role
                </p>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedOperator.role}
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Phone
                </p>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedOperator.phone ?? '—'}
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Email
                </p>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedOperator.email ?? '—'}
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Licence Number
                </p>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedOperator.riderProfile?.licenceNumber ?? '—'}
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Identity Card Number
                </p>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedOperator.riderProfile?.identityNumber ?? '—'}
                </div>
              </div>

              {selectedOperator.riderProfile?.leaseToOwn && (
                <>
                  <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Payment Plan
                    </p>
                    <div className="mt-2 text-sm font-semibold text-emerald-400">
                      Lease-to-Own
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Lease Principal
                    </p>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {(selectedOperator.riderProfile?.leasePrincipal ?? 0).toLocaleString()} RWF
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Lease Daily Rate
                    </p>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {(selectedOperator.riderProfile?.leaseDailyRate ?? 0).toLocaleString()} RWF
                    </div>
                  </div>
                </>
              )}

              {!selectedOperator.riderProfile?.leaseToOwn && selectedOperator.role === 'RIDER' && (
                <div className="rounded-[18px] border border-line bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Payment Plan
                  </p>
                  <div className="mt-2 text-sm font-semibold text-white">
                    Daily Collection
                  </div>
                </div>
              )}
            </section>

            {/* Documents Section */}
            {selectedOperator.role === 'RIDER' && (
              <div className="space-y-4 pt-4 border-t border-line">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Document Attachments
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-400">Driving Licence</p>
                    {selectedOperator.riderProfile?.licencePhoto ? (
                      <div
                        className="rounded-xl border border-line bg-white/5 overflow-hidden max-h-[160px] cursor-zoom-in"
                        onClick={() => {
                          if (selectedOperator.riderProfile?.licencePhoto) {
                            window.open(selectedOperator.riderProfile.licencePhoto);
                          }
                        }}
                      >
                        <img
                          src={selectedOperator.riderProfile.licencePhoto || undefined}
                          alt="Licence"
                          className="w-full object-cover max-h-[160px]"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line bg-white/5 p-4 text-center text-xs text-zinc-600">
                        No Licence Photo Uploaded
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-400">Identity Card</p>
                    {selectedOperator.riderProfile?.identityCardPhoto ? (
                      <div
                        className="rounded-xl border border-line bg-white/5 overflow-hidden max-h-[160px] cursor-zoom-in"
                        onClick={() => {
                          if (selectedOperator.riderProfile?.identityCardPhoto) {
                            window.open(selectedOperator.riderProfile.identityCardPhoto);
                          }
                        }}
                      >
                        <img
                          src={selectedOperator.riderProfile.identityCardPhoto || undefined}
                          alt="Identity Card"
                          className="w-full object-cover max-h-[160px]"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line bg-white/5 p-4 text-center text-xs text-zinc-600">
                        No Identity Card Photo Uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
