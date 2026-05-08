import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

// Standardizes empty states with a clear next-step call to action.
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="rounded-[24px] border border-dashed border-line-strong bg-surface-muted px-6 py-10 text-center">
      {icon ? (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-strong text-accent">
          {icon}
        </div>
      ) : null}
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
