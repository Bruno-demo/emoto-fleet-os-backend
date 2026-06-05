'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  Filter,
  Key,
  Lock,
  LogIn,
  MapPin,
  Search,
  Shield,
  Siren,
  UserPlus,
  Users,
  Bike,
  Plus,
  Trash,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { AuditActionType, AuditLogEntry, PaginatedResponse } from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimestamp } from '@/lib/ui';

const PAGE_SIZE = 25;

const ACTION_ICON: Partial<Record<AuditActionType, React.ReactNode>> = {
  LOGIN_SUCCESS: <LogIn size={13} />,
  LOGIN_FAILED: <AlertTriangle size={13} />,
  ACCOUNT_LOCKED: <Lock size={13} />,
  RIDER_CREATED: <UserPlus size={13} />,
  BIKE_ASSIGNMENT_CHANGED: <Users size={13} />,
  SOS_TRIGGERED: <Siren size={13} />,
  ZONE_CREATED: <MapPin size={13} />,
  ZONE_UPDATED: <MapPin size={13} />,
  ZONE_DELETED: <MapPin size={13} />,
  DEVICE_COMMAND_REQUESTED: <Key size={13} />,
  LOCK_ACTION_REQUESTED: <Lock size={13} />,
  DEVICE_SECRET_ROTATED: <Shield size={13} />,
  PARTNER_TOKEN_ISSUED: <Key size={13} />,
  BIKE_CREATED: <Plus size={13} />,
  BIKE_UPDATED: <Bike size={13} />,
  BIKE_DELETED: <Trash size={13} />,
  USER_ROLE_CHANGED: <Shield size={13} />,
  USER_INVITED: <UserPlus size={13} />,
};

const ACTION_TONE: Partial<Record<AuditActionType, 'danger' | 'warning' | 'success' | 'neutral'>> = {
  LOGIN_FAILED: 'danger',
  ACCOUNT_LOCKED: 'danger',
  SOS_TRIGGERED: 'danger',
  LOGIN_SUCCESS: 'success',
  RIDER_CREATED: 'success',
  ZONE_DELETED: 'warning',
  BIKE_CREATED: 'success',
  BIKE_UPDATED: 'neutral',
  BIKE_DELETED: 'danger',
  USER_ROLE_CHANGED: 'warning',
  USER_INVITED: 'success',
};

const ACTION_TYPE_OPTIONS: AuditActionType[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'ACCOUNT_LOCKED',
  'RIDER_CREATED',
  'BIKE_ASSIGNMENT_CHANGED',
  'SOS_TRIGGERED',
  'ZONE_CREATED',
  'ZONE_UPDATED',
  'ZONE_DELETED',
  'DEVICE_COMMAND_REQUESTED',
  'LOCK_ACTION_REQUESTED',
  'DEVICE_SECRET_ROTATED',
  'DEVICE_COMMAND_STATUS_CHANGED',
  'PARTNER_TOKEN_ISSUED',
  'PARTNER_API_ACCESS',
  'PARTNER_WEBHOOK_REGISTERED',
  'PARTNER_WEBHOOK_DELIVERY',
  'BIKE_CREATED',
  'BIKE_UPDATED',
  'BIKE_DELETED',
  'USER_ROLE_CHANGED',
  'USER_INVITED',
];

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<AuditActionType | ''>('');

  const logsQuery = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: () =>
      apiFetch<PaginatedResponse<AuditLogEntry>>(
        `/audit-logs${buildQueryString({
          page,
          pageSize: PAGE_SIZE,
          actionType: actionFilter || undefined,
        })}`,
      ),
  });

  const logs = useMemo(() => logsQuery.data?.data ?? [], [logsQuery.data?.data]);

  return (
    <div className="space-y-6">
      <DashboardCard
        eyebrow="Compliance"
        title="Audit trail"
        actions={
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Clock size={12} />
            {logsQuery.data?.total ?? 0} entries
          </div>
        }
      >
        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-ink-muted">
            <Filter size={13} />
            <span className="text-xs font-semibold uppercase tracking-wider">Filter</span>
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value as AuditActionType | '');
              setPage(1);
            }}
            className="rounded-xl border border-line bg-background px-3.5 py-2 text-sm text-ink outline-none focus:border-accent/50"
          >
            <option value="" className="bg-background text-ink">All actions</option>
            {ACTION_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type} className="bg-background text-ink">
                {formatEnumLabel(type)}
              </option>
            ))}
          </select>
        </div>

        {/* Log entries */}
        {logsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<Shield size={18} />}
            title="No audit entries"
            description="Audit logs will appear as fleet actions are recorded."
          />
        ) : (
          <div className="space-y-1">
            {logs.map((log) => {
              const tone = ACTION_TONE[log.actionType] ?? 'neutral';
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl border-b border-line px-3 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span
                    className={cx(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      tone === 'danger'
                        ? 'bg-danger-soft text-danger-ink'
                        : tone === 'warning'
                          ? 'bg-warning-soft text-warning-ink'
                          : tone === 'success'
                            ? 'bg-success-soft text-success-ink'
                            : 'bg-surface-muted text-ink-muted',
                    )}
                  >
                    {ACTION_ICON[log.actionType] ?? <Shield size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-ink">
                        {formatEnumLabel(log.actionType)}
                      </p>
                      <Badge label={log.targetType} tone="neutral" />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                      <span>{formatTimestamp(log.createdAt)}</span>
                      {log.actorUser?.email && (
                        <span>by {log.actorUser.email}</span>
                      )}
                      {log.targetId && (
                        <span className="font-mono text-ink-faint">
                          {log.targetId.length > 12
                            ? `${log.targetId.slice(0, 8)}...`
                            : log.targetId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PaginationControls
          page={logsQuery.data?.page ?? page}
          totalPages={logsQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </DashboardCard>
    </div>
  );
}

