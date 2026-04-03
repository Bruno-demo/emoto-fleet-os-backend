import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cx } from '@/lib/ui';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  securityHint?: string;
  features: Array<{ icon: ReactNode; title: string; description: string }>;
  children: ReactNode;
}

// Provides the shared branded layout for authentication screens.
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  securityHint,
  features,
  children,
}: AuthShellProps) {
  return (
    <div className="landing-theme min-h-screen bg-[var(--background)] px-5 py-10 text-ink">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-line bg-surface p-7 shadow-[var(--shadow-strong)] backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-muted">
            {eyebrow}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-ink text-background shadow-[var(--shadow-soft)]">
              <span className="text-lg font-semibold">E</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                E-Moto Fleet OS
              </p>
              <p className="text-sm font-semibold text-accent">Smart Mobility Starts Here</p>
            </div>
          </div>
          <h1 className="mt-5 text-[clamp(2rem,1.8rem+1vw,3rem)] font-semibold leading-tight text-ink">
            {title}
          </h1>
          <p className="mt-3 text-base leading-7 text-ink-soft">{subtitle}</p>
          {securityHint ? (
            <p className="mt-4 inline-flex items-center rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs font-semibold text-ink">
              {securityHint}
            </p>
          ) : null}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[20px] border border-line bg-surface-muted px-4 py-4 shadow-[var(--shadow-soft)]"
              >
                <span className="inline-flex rounded-[14px] bg-ink p-2 text-background">
                  {feature.icon}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-xs leading-5 text-ink-soft">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-line bg-surface-muted p-7 shadow-[var(--shadow-strong)] backdrop-blur">
          {children}
        </section>
      </div>
    </div>
  );
}

interface AuthPanelHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

// Renders the title and description for auth forms.
export function AuthPanelHeader({ eyebrow, title, description }: AuthPanelHeaderProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-muted">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
    </div>
  );
}

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: ReactNode;
  error?: string | null;
  helper?: string;
  rightElement?: ReactNode;
}

// Provides a branded input with icon, helper text, and validation styles.
export function AuthInput({
  label,
  icon,
  error,
  helper,
  rightElement,
  className,
  ...props
}: AuthInputProps) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <div className="relative mt-2">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            {icon}
          </span>
        ) : null}
        <input
          {...props}
          className={cx(
            'w-full rounded-[16px] border bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]',
            icon ? 'pl-11' : 'pl-4',
            rightElement ? 'pr-12' : 'pr-4',
            error ? 'border-danger-ink/40 focus:border-danger-ink focus:ring-danger-soft' : 'border-line',
            className,
          )}
        />
        {rightElement ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        ) : null}
      </div>
      {helper ? <p className="mt-2 text-xs text-ink-muted">{helper}</p> : null}
      {error ? <p className="mt-2 text-xs text-danger-ink">{error}</p> : null}
    </label>
  );
}

type AuthNoticeTone = 'error' | 'success' | 'warning';

interface AuthNoticeProps {
  message: string;
  tone?: AuthNoticeTone;
}

// Renders inline feedback for errors, warnings, and success states.
export function AuthNotice({ message, tone = 'error' }: AuthNoticeProps) {
  const toneStyles = {
    error: 'border-danger-ink/30 bg-danger-soft text-danger-ink',
    success: 'border-success-ink/30 bg-success-soft text-success-ink',
    warning: 'border-warning-ink/30 bg-warning-soft text-warning-ink',
  };

  return (
    <div className={cx('rounded-[14px] border px-4 py-3 text-xs font-medium', toneStyles[tone])}>
      {message}
    </div>
  );
}

interface AuthButtonProps {
  label: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  isLoading?: boolean;
  icon?: ReactNode;
}

// Provides primary and secondary CTA buttons with loading state.
export function AuthButton({
  label,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  isLoading,
  icon,
}: AuthButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cx(
        'inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold transition',
        variant === 'primary'
          ? 'bg-accent text-[color:var(--accent-foreground)] shadow-[var(--shadow-soft)] hover:bg-accent-strong'
          : 'border border-line bg-surface text-ink hover:border-line-strong',
        (disabled || isLoading) ? 'cursor-not-allowed opacity-60' : '',
      )}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : null}
      {icon ? <span className="text-base">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

interface AuthSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | null;
  helper?: string;
}

// Provides a branded select input for role and mode selection.
export function AuthSelect({ label, error, helper, className, children, ...props }: AuthSelectProps) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <div className="relative mt-2">
        <select
          {...props}
          className={cx(
            'w-full appearance-none rounded-[16px] border bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]',
            error ? 'border-danger-ink/40 focus:border-danger-ink focus:ring-danger-soft' : 'border-line',
            className,
          )}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
          v
        </span>
      </div>
      {helper ? <p className="mt-2 text-xs text-ink-muted">{helper}</p> : null}
      {error ? <p className="mt-2 text-xs text-danger-ink">{error}</p> : null}
    </label>
  );
}

interface AuthCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

// Renders a branded checkbox with accessible hit target.
export function AuthCheckbox({ checked, onChange, label, disabled }: AuthCheckboxProps) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-line text-accent focus:ring-[var(--ring)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}

interface AuthTabsProps {
  active: 'login' | 'signup';
}

// Creates a simple two-tab switcher between login and signup routes.
export function AuthTabs({ active }: AuthTabsProps) {
  return (
    <div className="mt-6 grid grid-cols-2 rounded-[14px] bg-surface-hover p-1 text-xs font-semibold">
      <a
        href="/login"
        className={cx(
          'rounded-[12px] px-3 py-2 text-center transition',
          active === 'login' ? 'bg-surface text-ink shadow' : 'text-ink-muted',
        )}
      >
        Login
      </a>
      <a
        href="/create-account"
        className={cx(
          'rounded-[12px] px-3 py-2 text-center transition',
          active === 'signup' ? 'bg-surface text-ink shadow' : 'text-ink-muted',
        )}
      >
        Sign up
      </a>
    </div>
  );
}
