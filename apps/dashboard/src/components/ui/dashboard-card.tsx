import type { ReactNode } from 'react';
import { cx } from '@/lib/ui';

interface DashboardCardProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

// Standardizes the main dashboard surface styling for sections and detail panes.
export function DashboardCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: DashboardCardProps) {
  return (
    <section
      className={cx(
        'rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      {eyebrow || title || description || actions ? (
        <header className="flex flex-col gap-2 border-b border-line/80 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-2 font-display text-[clamp(1.15rem,1rem+0.7vw,1.6rem)] font-semibold text-ink">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-2 max-w-3xl text-[13px] leading-5 text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx('px-4 py-3', contentClassName)}>{children}</div>
    </section>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}

const METRIC_TONE_CLASS: Record<NonNullable<MetricCardProps['tone']>, string> = {
  info: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  neutral: 'bg-surface-strong text-ink-soft',
};

// Provides a consistent metric tile used across overview, reports, bikes, and incidents.
export function MetricCard({
  title,
  value,
  hint,
  icon,
  tone = 'info',
}: MetricCardProps) {
  return (
    <article className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            {title}
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            {value}
          </p>
        </div>
        <span className={cx('rounded-[16px] p-2.5', METRIC_TONE_CLASS[tone])}>{icon}</span>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-ink-soft">{hint}</p>
    </article>
  );
}
