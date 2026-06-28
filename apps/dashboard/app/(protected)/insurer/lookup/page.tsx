'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Search,
  Bike,
  User,
  Shield,
  Activity,
  Calendar,
  AlertTriangle,
  Route,
  ArrowRight,
} from 'lucide-react';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { apiFetch } from '@/lib/api/client';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { EmptyState } from '@/components/ui/empty-state';
import { cx, formatTimestamp } from '@/lib/ui';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface SearchBikeResult {
  id: string;
  label: string;
  serial: string;
}

interface SearchRiderResult {
  id: string;
  email: string;
  riderProfile?: {
    fullName?: string;
  };
}

interface BikeDetails {
  id: string;
  label: string;
  serial: string;
}

interface BikeMileage {
  weeklyMileageKm: number;
  tripCount: number;
}

interface RiderDetails {
  id: string;
  email: string;
  riderProfile?: {
    fullName?: string;
  };
}

interface RiderScore {
  avgScore: number;
  tripCount: number;
}

interface TripInfo {
  id: string;
  distanceKm: number;
  startTs: string;
  score: number;
}

export default function InsurerLookupPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  // 1. Search for matching bikes
  const bikesSearchQuery = useQuery({
    queryKey: ['bikes', 'search', searchTerm],
    queryFn: () =>
      apiFetch<PaginatedResponse<SearchBikeResult>>(`/bikes?search=${encodeURIComponent(searchTerm)}&pageSize=5`),
    enabled: searchTerm.length > 2,
  });

  // 2. Search for matching riders
  const ridersSearchQuery = useQuery({
    queryKey: ['riders', 'search', searchTerm],
    queryFn: () =>
      apiFetch<PaginatedResponse<SearchRiderResult>>(`/riders?search=${encodeURIComponent(searchTerm)}&pageSize=5`),
    enabled: searchTerm.length > 2,
  });

  // 3. Fetch details for selected bike
  const bikeDetailsQuery = useQuery({
    queryKey: ['bikes', selectedBikeId],
    queryFn: () => apiFetch<BikeDetails>(`/bikes/${selectedBikeId}`),
    enabled: !!selectedBikeId,
  });

  const bikeMileageQuery = useQuery({
    queryKey: ['bikes', selectedBikeId, 'mileage'],
    queryFn: () => apiFetch<BikeMileage>(`/bikes/${selectedBikeId}/weekly-mileage`),
    enabled: !!selectedBikeId,
  });

  const bikeTripsQuery = useQuery({
    queryKey: ['bikes', selectedBikeId, 'trips'],
    queryFn: () => apiFetch<PaginatedResponse<TripInfo>>(`/trips?bikeId=${selectedBikeId}&pageSize=5`),
    enabled: !!selectedBikeId,
  });

  // 4. Fetch details for selected rider
  const riderDetailsQuery = useQuery({
    queryKey: ['riders', selectedRiderId],
    queryFn: () => apiFetch<RiderDetails>(`/riders/${selectedRiderId}`),
    enabled: !!selectedRiderId,
  });

  const riderScoreQuery = useQuery({
    queryKey: ['riders', selectedRiderId, 'score'],
    queryFn: () => apiFetch<RiderScore>(`/riders/${selectedRiderId}/score`),
    enabled: !!selectedRiderId,
  });

  const riderTripsQuery = useQuery({
    queryKey: ['riders', selectedRiderId, 'trips'],
    queryFn: () => apiFetch<PaginatedResponse<TripInfo>>(`/trips?riderId=${selectedRiderId}&pageSize=5`),
    enabled: !!selectedRiderId,
  });

  const handleSelectBike = (id: string) => {
    setSelectedBikeId(id);
    setSelectedRiderId(null);
  };

  const handleSelectRider = (id: string) => {
    setSelectedRiderId(id);
    setSelectedBikeId(null);
  };

  const hasSearch = searchTerm.length > 2;
  const matchingBikes = bikesSearchQuery.data?.data ?? [];
  const matchingRiders = ridersSearchQuery.data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          {t('Insurer Investigation Room')}
        </h1>
        <p className="text-sm text-zinc-400">
          {t('Lookup any insured bike by frame number/VIN, or search riders by ID/name to audit risk profile.')}
        </p>
      </div>

      {/* Lookup search bar */}
      <DashboardCard eyebrow={t('Search')} title={t('Unified Lookup')}>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder={t('Enter VIN, Bike Plate, Rider ID, or Rider Name...')}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value.length === 0) {
                setSelectedBikeId(null);
                setSelectedRiderId(null);
              }
            }}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-12 pr-4 py-3.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-accent focus:bg-white/[0.04]"
          />
        </div>

        {/* Real-time search results */}
        {hasSearch && !selectedBikeId && !selectedRiderId && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Bikes results */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Bike size={13} /> {t('Matching Bikes')}
              </h3>
              {bikesSearchQuery.isLoading ? (
                <p className="text-xs text-zinc-500">{t('Searching...')}</p>
              ) : matchingBikes.length ? (
                <ul className="space-y-2">
                  {matchingBikes.map((bike) => (
                    <li key={bike.id}>
                      <button
                        onClick={() => handleSelectBike(bike.id)}
                        className="w-full flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-left text-xs hover:bg-white/[0.06] transition"
                      >
                        <div>
                          <p className="font-semibold text-white">{bike.label}</p>
                          <p className="text-zinc-500 text-[10px]">VIN: {bike.serial}</p>
                        </div>
                        <ArrowRight size={14} className="text-zinc-500" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">{t('No matching bikes found')}</p>
              )}
            </div>

            {/* Riders results */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <User size={13} /> {t('Matching Riders')}
              </h3>
              {ridersSearchQuery.isLoading ? (
                <p className="text-xs text-zinc-500">{t('Searching...')}</p>
              ) : matchingRiders.length ? (
                <ul className="space-y-2">
                  {matchingRiders.map((rider) => (
                    <li key={rider.id}>
                      <button
                        onClick={() => handleSelectRider(rider.id)}
                        className="w-full flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-left text-xs hover:bg-white/[0.06] transition"
                      >
                        <div>
                          <p className="font-semibold text-white">{rider.riderProfile?.fullName ?? rider.email}</p>
                          <p className="text-zinc-500 text-[10px]">ID: {rider.id}</p>
                        </div>
                        <ArrowRight size={14} className="text-zinc-500" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">{t('No matching riders found')}</p>
              )}
            </div>
          </div>
        )}
      </DashboardCard>

      {/* Selected Entity Details */}
      {(selectedBikeId || selectedRiderId) && (
        <div className="space-y-6">
          {/* Overview Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedBikeId && (
              <>
                <MetricCard
                  title={t('VIN / Serial')}
                  value={bikeDetailsQuery.data?.serial ?? '...'}
                  hint={t('Assigned tracking identifier')}
                  icon={<Shield size={20} className="text-accent" />}
                />
                <MetricCard
                  title={t('Weekly Mileage')}
                  value={
                    bikeMileageQuery.isLoading
                      ? '...'
                      : `${bikeMileageQuery.data?.weeklyMileageKm ?? 0} km`
                  }
                  hint={t('Exact kilometers driven in last 7 days')}
                  icon={<Route size={20} className="text-emerald-400" />}
                />
                <MetricCard
                  title={t('Trips Recorded')}
                  value={String(bikeMileageQuery.data?.tripCount ?? 0)}
                  hint={t('Total trips in active week window')}
                  icon={<Calendar size={20} className="text-purple-400" />}
                />
              </>
            )}

            {selectedRiderId && (
              <>
                <MetricCard
                  title={t('Rider Name')}
                  value={riderDetailsQuery.data?.riderProfile?.fullName ?? '...'}
                  hint={t('Assigned driver identity')}
                  icon={<User size={20} className="text-accent" />}
                />
                <MetricCard
                  title={t('30-Day Safety Score')}
                  value={
                    riderScoreQuery.isLoading
                      ? '...'
                      : `${riderScoreQuery.data?.avgScore ?? 100} / 100`
                  }
                  hint={t('Safety index calculated over last 30 days')}
                  icon={<Shield size={20} className="text-emerald-400" />}
                />
                <MetricCard
                  title={t('Trips Scored')}
                  value={String(riderScoreQuery.data?.tripCount ?? 0)}
                  hint={t('Trips feeding safety score algorithm')}
                  icon={<Calendar size={20} className="text-purple-400" />}
                />
              </>
            )}
          </div>

          {/* Recent Trips Table */}
          <div className="grid gap-6 md:grid-cols-2">
            <DashboardCard
              eyebrow={t('Exposure')}
              title={t('Recent Insured Trips')}
              description={t('Recent completed trips for this target.')}
            >
              {selectedBikeId && bikeTripsQuery.isLoading && (
                <p className="text-xs text-zinc-500">{t('Loading trips...')}</p>
              )}
              {selectedRiderId && riderTripsQuery.isLoading && (
                <p className="text-xs text-zinc-500">{t('Loading trips...')}</p>
              )}

              {/* Render Trips */}
              {((selectedBikeId && bikeTripsQuery.data?.data?.length) ||
                (selectedRiderId && riderTripsQuery.data?.data?.length)) ? (
                <ul className="divide-y divide-white/[0.04]">
                  {((selectedBikeId ? bikeTripsQuery.data?.data : riderTripsQuery.data?.data) ?? []).map((trip) => (
                    <li key={trip.id} className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-white">{trip.distanceKm.toFixed(2)} km</p>
                        <p className="text-zinc-500 text-[10px]">{formatTimestamp(trip.startTs)}</p>
                      </div>
                      <div className="text-right">
                        <span className={cx(
                          'rounded-md px-2 py-0.5 font-bold',
                          trip.score >= 90
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : trip.score >= 70
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-rose-500/10 text-rose-400'
                        )}>
                          {Math.round(trip.score)} / 100
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Route size={18} />}
                  title={t('No recent trips')}
                  description={t('No completed trip history is registered.')}
                />
              )}
            </DashboardCard>

            {/* Risk Indicators / Alerts Card */}
            <DashboardCard
              eyebrow={t('Scoring Alerts')}
              title={t('High-Risk Behavior Triggers')}
              description={t('Recent harsh braking, speeding, or cornering events.')}
            >
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                    <AlertTriangle size={15} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{t('Harsh Telemetry Events')}</h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                      {t('Accelerometers monitor sudden Deceleration (Harsh Braking), High Accel, and Aggressive Cornering. Review events under the Events log.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-t border-white/[0.04] pt-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                    <Activity size={15} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{t('Speed limit violation alerts')}</h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                      {t('Riders going beyond the 60 km/h national default limit or signed highway zones are immediately flagged as speeding.')}
                    </p>
                  </div>
                </div>
              </div>
            </DashboardCard>
          </div>
        </div>
      )}
    </div>
  );
}
