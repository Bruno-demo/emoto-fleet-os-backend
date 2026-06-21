import type { ReactNode } from 'react';
import { cx } from '@/lib/ui';

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'critical'
  | 'low'
  | 'medium'
  | 'high';

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'border-line bg-surface-muted text-ink-soft',
  info: 'border-accent/20 bg-accent-soft text-accent',
  success: 'border-success-ink/20 bg-success-soft text-success-ink',
  warning: 'border-warning-ink/20 bg-warning-soft text-warning-ink',
  danger: 'border-danger-ink/20 bg-danger-soft text-danger-ink',
  critical: 'border-critical-ink/20 bg-critical-soft text-critical-ink',
  low: 'border-low-ink/20 bg-low-soft text-low-ink',
  medium: 'border-accent/20 bg-accent-soft text-accent',
  high: 'border-warning-ink/20 bg-warning-soft text-warning-ink',
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

// Renders a reusable status/severity badge with optional icon support.
export function Badge({
  label,
  tone = 'neutral',
  icon,
  size = 'md',
  className,
}: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        BADGE_TONE_CLASS[tone],
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {label}
    </span>
  );
}

