import { cx } from '@/lib/ui';

interface SkeletonProps {
  className?: string;
}

// Renders a lightweight skeleton shimmer for loading states.
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cx(
        'animate-pulse rounded-2xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100',
        className,
      )}
    />
  );
}

// Builds a shared metric-card loading placeholder.
export function MetricCardSkeleton() {
  return (
    <article className="rounded-[var(--radius-panel)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-10 w-28" />
      <Skeleton className="mt-6 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
    </article>
  );
}

// Builds table-like row placeholders without requiring per-page markup duplication.
export function TableRowsSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`table-skeleton-${rowIndex}`}
          className="grid gap-3 rounded-[18px] border border-line bg-surface-muted px-4 py-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={`table-skeleton-${rowIndex}-${columnIndex}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Builds drawer placeholders used by bike and incident side panels.
export function DrawerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}
