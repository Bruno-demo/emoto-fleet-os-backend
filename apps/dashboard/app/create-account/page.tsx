'use client';

import { Building2, ShieldCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { InlineNotice, SelectField, TextField } from '@/components/ui/form-controls';
import { ApiError, apiFetch } from '@/lib/api/client';
import { readAuthToken } from '@/lib/auth/session';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { UserRole } from '@/lib/types/dashboard';

const registerFormSchema = z
  .object({
    email: z.string().email('Enter a valid email').optional(),
    phone: z.string().min(6, 'Enter a valid phone number').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm password'),
    role: z.enum(['ADMIN', 'DISPATCHER', 'TECH', 'RIDER']),
  })
  .superRefine((data, context) => {
    if (!data.email && !data.phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either email or phone',
        path: ['email'],
      });
    }
    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });

const roleOptions: Array<{ value: UserRole; label: string; description: string }> = [
  { value: 'ADMIN', label: 'Admin', description: 'Full fleet access with policy control.' },
  { value: 'DISPATCHER', label: 'Dispatcher', description: 'Live operations and incident response.' },
  { value: 'TECH', label: 'Technician', description: 'Device provisioning and bike maintenance.' },
  { value: 'RIDER', label: 'Rider', description: 'Mobile app access only.' },
];

type FieldErrors = Partial<
  Record<'fleetId' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'role', string>
>;

// Renders the account provisioning screen with access gating and validation.
export default function CreateAccountPage() {
  const { data: currentUser, isLoading, isError } = useCurrentUser();
  const [fleetId, setFleetId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('DISPATCHER');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = typeof window !== 'undefined' ? readAuthToken() : null;
  const sessionInvalid = Boolean(token) && isError;
  const registrationMode = useMemo(() => {
    if (!token || sessionInvalid) {
      return 'public';
    }
    if (isLoading) {
      return 'checking';
    }
    if (!currentUser) {
      return 'public';
    }
    if (currentUser.role === 'OWNER' || currentUser.role === 'ADMIN') {
      return 'admin';
    }
    return 'limited';
  }, [token, sessionInvalid, isLoading, currentUser]);

  const isAdminMode = registrationMode === 'admin';
  const isPublicMode = registrationMode === 'public';
  const isLimitedMode = registrationMode === 'limited';
  const isChecking = registrationMode === 'checking';

  const availableRoles = isAdminMode
    ? roleOptions
    : roleOptions.filter((option) => option.value === 'RIDER');

  const accessNotice = useMemo(() => {
    if (isPublicMode) {
      return {
        tone: 'warning' as const,
        message: sessionInvalid
          ? 'Session expired. Sign in to create staff accounts, or continue with rider-only public sign-up.'
          : 'Public sign-up creates rider accounts only. Enter the fleet ID provided by your admin.',
      };
    }
    if (isChecking) {
      return {
        tone: 'warning' as const,
        message: 'Checking account permissions before enabling registration.',
      };
    }
    if (isLimitedMode) {
      return {
        tone: 'warning' as const,
        message: 'Your role can create rider accounts only.',
      };
    }
    return null;
  }, [isPublicMode, isChecking, isLimitedMode, sessionInvalid]);

  const isFormDisabled = isSubmitting || isChecking;

  useEffect(() => {
    if (!isAdminMode && role !== 'RIDER') {
      setRole('RIDER');
    }
  }, [isAdminMode, role]);

  // Validates inputs and calls the admin-only register endpoint for the current fleet.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    if (isPublicMode) {
      const parsedFleetId = z
        .string()
        .uuid('Enter a valid fleet ID')
        .safeParse(fleetId.trim());
      if (!parsedFleetId.success) {
        setFieldErrors({ fleetId: parsedFleetId.error.issues[0]?.message });
        setError(parsedFleetId.error.issues[0]?.message ?? 'Fleet ID is required');
        return;
      }
    }

    const parsed = registerFormSchema.safeParse({
      email: email.trim() ? email.trim() : undefined,
      phone: phone.trim() ? phone.trim() : undefined,
      password,
      confirmPassword,
      role,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: flattened.email?.[0],
        phone: flattened.phone?.[0],
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
        role: flattened.role?.[0],
      });
      setError(parsed.error.issues[0]?.message ?? 'Please review the form inputs');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isPublicMode) {
        await apiFetch(
          '/auth/register-public',
          {
            method: 'POST',
            body: JSON.stringify({
              fleetId: fleetId.trim(),
              email: parsed.data.email,
              phone: parsed.data.phone,
              password: parsed.data.password,
            }),
          },
          { auth: false },
        );
      } else {
        await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: parsed.data.email,
            phone: parsed.data.phone,
            password: parsed.data.password,
            role: parsed.data.role,
          }),
        });
      }

      setSuccess('Account created. Share the login credentials securely with the new operator.');
      setFleetId('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setRole('DISPATCHER');
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError('Unable to create an account right now');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(5,150,105,0.12),transparent_28%),var(--background)] px-5 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-line bg-surface px-7 py-7 shadow-[var(--shadow-strong)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            Fleet identity
          </p>
          <h1 className="mt-4 max-w-xl font-display text-[clamp(2.1rem,1.7rem+1.1vw,3.1rem)] font-semibold leading-tight text-ink">
            Provision operator access with the right roles and scope for each team.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
            Create dispatcher, technician, admin, or rider accounts inside the current fleet.
            Registration is gated by fleet policy and is disabled by default in production.
          </p>

          <div className="mt-7 grid gap-3 md:grid-cols-2">
            <FeatureTile
              icon={<UserPlus size={18} />}
              title="Controlled onboarding"
              description="Issue credentials only after verifying the operator and required role."
            />
            <FeatureTile
              icon={<ShieldCheck size={18} />}
              title="Fleet-scoped access"
              description="Every account stays locked to a single fleet for data isolation."
            />
            <FeatureTile
              icon={<Building2 size={18} />}
              title="Ready for scaling"
              description="Add riders or dispatchers as your fleet footprint grows."
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-line bg-surface px-7 py-7 shadow-[var(--shadow-strong)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            Create account
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">New operator</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Add a new user in your fleet. Share credentials securely and remind the operator to
            reset their password after first login.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {accessNotice ? <InlineNotice message={accessNotice.message} tone={accessNotice.tone} /> : null}
            {error ? <InlineNotice message={error} /> : null}
            {success ? <InlineNotice message={success} tone="success" /> : null}

            {isPublicMode ? (
              <TextField
                label="Fleet ID"
                placeholder="Paste fleet UUID"
                value={fleetId}
                onChange={(event) => setFleetId(event.target.value)}
                error={fieldErrors.fleetId}
                disabled={isFormDisabled}
              />
            ) : null}
            <TextField
              label="Email address"
              placeholder="operator@fleet.example"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
              disabled={isFormDisabled}
            />
            <TextField
              label="Phone number"
              placeholder="+2507..."
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              error={fieldErrors.phone}
              disabled={isFormDisabled}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password}
                disabled={isFormDisabled}
              />
              <TextField
                label="Confirm password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                error={fieldErrors.confirmPassword}
                disabled={isFormDisabled}
              />
            </div>

            <SelectField
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              error={fieldErrors.role}
              disabled={isFormDisabled || !isAdminMode}
            >
              {availableRoles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </SelectField>

            <button
              type="submit"
              disabled={isFormDisabled}
              className="inline-flex w-full items-center justify-center rounded-[var(--radius-control)] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
              <span>Already have credentials?</span>
              <Link href="/login" className="font-semibold text-accent hover:text-accent-strong">
                Return to login
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

// Displays a compact capability card for the create-account overview panel.
function FeatureTile({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[22px] border border-line bg-surface-muted px-4 py-4">
      <span className="inline-flex rounded-[16px] bg-white p-2.5 text-accent">{icon}</span>
      <h3 className="mt-3 font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
    </article>
  );
}
