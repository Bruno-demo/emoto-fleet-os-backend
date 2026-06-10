import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import Link from 'next/link';
import { Command } from 'lucide-react';
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
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2 bg-[var(--background)] text-ink">
      {/* Left Pane - Immersive Brand Area */}
      <section className="dark relative hidden lg:flex flex-col justify-start gap-16 overflow-hidden p-12 pt-16">
        {/* Deep, immersive abstract background */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center brightness-50"
          style={{ backgroundImage: 'linear-gradient(135deg, rgba(11, 15, 25, 0.9), rgba(11, 15, 25, 0.4)), url(https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80)' }}
        />
        
        {/* Glow Effects */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.3)_0%,transparent_50%)]" />

        {/* Top Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3 self-start group">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-ink shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform">
            <Command size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent group-hover:text-accent/80 transition-colors">
              E-Moto
            </p>
            <p className="font-display text-sm font-bold text-white group-hover:text-white/80 transition-colors">Fleet OS</p>
          </div>
        </Link>

        {/* Content Box */}
        <div className="relative z-10 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-[clamp(2rem,2.5vw,3rem)] font-semibold leading-tight text-white max-w-lg">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-white/70 max-w-lg">
            {subtitle}
          </p>
          {securityHint && (
            <p className="mt-5 inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-white">
              {securityHint}
            </p>
          )}

          <div className="mt-12 grid gap-4">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4 p-4 rounded-[20px] bg-white/[0.06] backdrop-blur-sm border border-white/10">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-accent/20 border border-white/10 text-accent">
                  {feature.icon}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-white/55">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right Pane - Centered Auth Form */}
      <section className="flex flex-col justify-center items-center p-6 sm:p-12 lg:p-20 relative z-10">
        <div className="w-full max-w-[440px] glass-panel rounded-[28px] p-8 md:p-10 transition-all shadow-[var(--shadow-strong)] relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-100 pointer-events-none"></div>
           <div className="relative z-10">
             {children}
           </div>
        </div>
        <p className="absolute bottom-8 text-xs text-ink-muted hidden lg:block">
          (C) 2026 E-Moto Safety.
        </p>
      </section>
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
  label: ReactNode;
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
            'w-full rounded-[16px] border bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)] placeholder:text-ink-faint hover:border-line-strong',
            icon ? 'pl-11' : 'pl-4',
            rightElement ? 'pr-12' : 'pr-4',
            error ? 'border-danger-ink/40 focus:border-danger-ink focus:ring-danger-soft' : 'border-line-strong',
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
        'inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95',
        variant === 'primary'
          ? 'hover:brightness-110 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]'
          : 'border border-line-strong bg-surface-muted text-ink hover:bg-surface-hover',
        (disabled || isLoading) ? 'cursor-not-allowed opacity-60' : '',
      )}
      style={variant === 'primary' ? { background: '#3B82F6', color: 'white' } : undefined}
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
            'w-full appearance-none rounded-[16px] border bg-surface-hover-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]',
            error ? 'border-danger-ink/40 focus:border-danger-ink focus:ring-danger-soft' : 'border-line-strong',
            className,
          )}
        >
          {children}
        </select>
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
    <div className="mt-6 grid grid-cols-2 rounded-[14px] bg-surface-muted p-1 text-xs font-semibold border border-line-strong">
      <a
        href="/login"
        className={cx(
          'rounded-[12px] px-3 py-2 text-center transition-all',
          active === 'login' ? 'bg-surface text-ink shadow-[var(--shadow-strong)]' : 'text-ink-muted hover:text-ink',
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

