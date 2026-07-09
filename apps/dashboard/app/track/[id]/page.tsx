'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  MapPin,
  User,
  Shield,
  Loader,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { apiFetch } from '@/lib/api/client';
import { cx, formatTimestamp } from '@/lib/ui';
import { translations } from '@/lib/i18n/dictionaries';

interface TrackingPayload {
  delivery: {
    id: string;
    orderNumber: string;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    customerName: string;
    status: 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
    failureReason?: string | null;
    proofPhotoUrl?: string | null;
    notes?: string | null;
    assignedAt?: string | null;
    pickedUpAt?: string | null;
    deliveredAt?: string | null;
    failedAt?: string | null;
    createdAt: string;
  };
  riderName: string | null;
  bike: {
    id: string;
    label: string;
    plate: string | null;
  } | null;
  liveState: {
    lat: number;
    lng: number;
    speedKph: number;
    ts: string;
  } | null;
}

const PublicTrackMap = dynamic(
  () => import('@/components/public/public-track-map').then((m) => m.PublicTrackMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface border border-line rounded-2xl">
        <Loader className="h-10 w-10 animate-spin text-accent mb-3" />
        <p className="text-sm font-semibold text-ink-muted">Loading live tracking basemap...</p>
      </div>
    ),
  }
);

export default function PublicTrackingPage() {
  const { id } = useParams() as { id: string };
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery<TrackingPayload>({
    queryKey: ['public-track', id],
    queryFn: () => apiFetch(`/deliveries/public/${id}/track`),
    refetchInterval: 5000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#09090b] text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-10 w-10 animate-spin text-accent" />
          <p className="text-sm font-semibold text-zinc-400">Loading delivery tracking details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#09090b] text-white px-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center space-y-4 shadow-xl">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">Tracking Link Invalid</h2>
          <p className="text-sm text-zinc-400">
            We couldn&apos;t retrieve tracking information for this order. The link may have expired or is incorrect.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-white/10 px-6 py-2.5 text-xs font-bold text-white hover:bg-white/15 transition-all"
          >
            Go to Portal
          </Link>
        </div>
      </div>
    );
  }

  const { delivery, riderName, liveState } = data;

  // Status mapping
  const steps = [
    { key: 'PENDING', label: 'Ordered', icon: Package },
    { key: 'ASSIGNED', label: 'Courier Assigned', icon: Clock },
    { key: 'PICKED_UP', label: 'Picked Up', icon: Truck },
    { key: 'IN_TRANSIT', label: 'Out for Delivery', icon: Truck },
    { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
  ];

  const getStepIndex = (status: string) => {
    if (status === 'PENDING') return 0;
    if (status === 'ASSIGNED') return 1;
    if (status === 'PICKED_UP') return 2;
    if (status === 'IN_TRANSIT') return 3;
    if (status === 'DELIVERED') return 4;
    if (status === 'FAILED') return 4; // Map failed to the final step but highlight failed
    return 0;
  };

  const currentStepIndex = getStepIndex(delivery.status);

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-white">
      {/* Brand Header */}
      <header className="border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-[1000]">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/20">
            <Shield size={18} className="text-ink" />
          </div>
          <span className="font-extrabold text-sm uppercase tracking-widest text-white">
            e-Moto <span className="text-accent">Fleet OS</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Live Telemetry Active</span>
        </div>
      </header>

      {/* Main Track Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Left Info Panel */}
        <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Status Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Order Tracking</div>
                  <div className="font-mono text-sm font-bold mt-0.5">{delivery.orderNumber}</div>
                </div>
                <span
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
                    delivery.status === 'PENDING' && 'bg-amber-500/10 text-amber-400',
                    delivery.status === 'ASSIGNED' && 'bg-blue-500/10 text-blue-400',
                    delivery.status === 'PICKED_UP' && 'bg-purple-500/10 text-purple-400',
                    delivery.status === 'IN_TRANSIT' && 'bg-cyan-500/10 text-cyan-400',
                    delivery.status === 'DELIVERED' && 'bg-emerald-500/10 text-emerald-400',
                    delivery.status === 'FAILED' && 'bg-rose-500/10 text-rose-400'
                  )}
                >
                  {delivery.status === 'FAILED' ? 'FAILED' : delivery.status}
                </span>
              </div>

              {/* Step Progress Tracker */}
              {delivery.status === 'FAILED' ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex gap-3 items-start">
                  <XCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-400">Delivery Run Failed</h4>
                    <p className="text-xs text-zinc-400 mt-1">{delivery.failureReason || 'Package could not be delivered.'}</p>
                    {delivery.failedAt && (
                      <span className="text-[10px] text-zinc-500 font-bold block mt-2">
                        {formatTimestamp(delivery.failedAt)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-800">
                  {steps.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isCompleted = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div key={step.key} className="relative flex gap-4 items-start">
                        <div
                          className={cx(
                            'absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300 z-10',
                            isCompleted
                              ? 'bg-accent border-accent text-ink'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                          )}
                        >
                          <StepIcon size={12} />
                        </div>
                        <div>
                          <h4
                            className={cx(
                              'text-xs font-bold',
                              isCompleted ? 'text-white' : 'text-zinc-500',
                              isCurrent && 'text-accent font-extrabold'
                            )}
                          >
                            {step.label}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] text-zinc-400 block mt-0.5">
                              {delivery.status === 'DELIVERED' && delivery.deliveredAt
                                ? formatTimestamp(delivery.deliveredAt)
                                : delivery.status === 'PICKED_UP' && delivery.pickedUpAt
                                ? formatTimestamp(delivery.pickedUpAt)
                                : delivery.status === 'ASSIGNED' && delivery.assignedAt
                                ? formatTimestamp(delivery.assignedAt)
                                : 'In Progress'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Courier Profile */}
            {riderName && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Your Courier</div>
                  <div className="font-bold text-sm text-white mt-0.5">{riderName}</div>
                  {liveState && (
                    <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                      <Truck size={12} className="text-accent" />
                      Traveling at {liveState.speedKph} km/h
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Location Summary */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <MapPin size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Pickup Address</div>
                  <div className="text-xs font-bold text-white mt-0.5">{delivery.pickupAddress}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Dropoff Destination</div>
                  <div className="text-xs font-bold text-white mt-0.5">{delivery.dropoffAddress}</div>
                </div>
              </div>
            </div>

            {delivery.notes && (
              <div className="border-t border-zinc-800 pt-3 flex gap-2">
                <FileText size={14} className="text-zinc-500 mt-0.5" />
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Delivery Instructions</div>
                  <p className="text-xs text-zinc-400 mt-0.5">{delivery.notes}</p>
                </div>
              </div>
            )}

            {/* Proof photo rendering */}
            {delivery.proofPhotoUrl && (
              <div className="border-t border-zinc-800 pt-3 space-y-2">
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Delivery Confirmation</div>
                <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-video relative">
                  <img
                    src={delivery.proofPhotoUrl}
                    alt="Proof of Delivery"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                    <span className="text-[10px] text-emerald-400 font-bold">✓ Package Handed Over</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Map Panel */}
        <div className="lg:col-span-8 h-[60vh] lg:h-auto min-h-[450px]">
          <PublicTrackMap
            pickup={{ lat: Number(delivery.pickupLat), lng: Number(delivery.pickupLng), address: delivery.pickupAddress }}
            dropoff={{ lat: Number(delivery.dropoffLat), lng: Number(delivery.dropoffLng), address: delivery.dropoffAddress }}
            rider={
              liveState
                ? { lat: Number(liveState.lat), lng: Number(liveState.lng), speedKph: liveState.speedKph, name: riderName }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
