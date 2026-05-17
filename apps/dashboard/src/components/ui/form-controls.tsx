import type { SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/ui';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}

function FieldShell({ label, hint, error, children }: FieldShellProps) {
  return (
    <label className="block text-sm font-medium text-ink">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint ? <span className="text-xs font-medium text-ink-faint">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-2 text-xs text-danger-ink">{error}</p> : null}
    </label>
  );
}

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <input
        {...props}
        className={cx(
          'w-full rounded-[var(--radius-control)] border border-line bg-surface-hover px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20 placeholder:text-ink-faint',
          className,
        )}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function SelectField({ label, hint, error, className, children, ...props }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <select
        {...props}
        className={cx(
          'w-full rounded-[var(--radius-control)] border border-line bg-surface-hover-hover px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20',
          className,
        )}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...props
}: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <textarea
        {...props}
        className={cx(
          'min-h-28 w-full rounded-[var(--radius-panel)] border border-line bg-surface-hover px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20 placeholder:text-ink-faint',
          className,
        )}
      />
    </FieldShell>
  );
}

interface InlineNoticeProps {
  message: string;
  tone?: 'danger' | 'success' | 'warning';
}

export function InlineNotice({ message, tone = 'danger' }: InlineNoticeProps) {
  return (
    <p
      className={cx(
        'rounded-[18px] border px-4 py-3 text-sm',
        tone === 'success'
          ? 'border-success-ink/30 bg-success-soft text-success-ink'
          : tone === 'warning'
            ? 'border-warning-ink/30 bg-warning-soft text-warning-ink'
            : 'border-danger-ink/30 bg-danger-soft text-danger-ink',
      )}
    >
      {message}
    </p>
  );
}

