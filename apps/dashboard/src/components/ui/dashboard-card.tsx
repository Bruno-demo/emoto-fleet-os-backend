import type { ReactNode } from 'react';
import { cx } from '@/lib/ui';

interface DashboardCardProps {
  id?: string;
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
  id,
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
      id={id}
      className={cx(
        'glass-panel rounded-[24px] border border-line shadow-[var(--shadow)] transition-all overflow-hidden',
        className,
      )}
    >
      {eyebrow || title || description || actions ? (
        <header className="flex flex-col gap-2 border-b border-line bg-surface-muted px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
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
      <div className={cx('px-6 py-6', contentClassName)}>{children}</div>
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
  info: 'bg-accent/20 text-accent border border-accent/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
  success: 'bg-success-ink/20 text-success-ink border border-success-ink/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
  warning: 'bg-warning-ink/20 text-warning-ink border border-warning-ink/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
  danger: 'bg-danger-ink/20 text-danger-ink border border-danger-ink/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
  neutral: 'bg-ink-faint/20 text-ink-muted border border-line',
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
    <article className="glass-panel group rounded-[24px] border border-line bg-surface-muted p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.15)] hover:border-line-strong relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-line-strong to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">
            {title}
          </p>
          <p className="mt-4 font-display text-4xl font-bold tracking-tight text-ink drop-shadow-sm">
            {value}
          </p>
        </div>
        <span className={cx('rounded-[16px] p-2.5', METRIC_TONE_CLASS[tone])}>{icon}</span>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-ink-soft">{hint}</p>
    </article>
  );
}

