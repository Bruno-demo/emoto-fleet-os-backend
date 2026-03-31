'use client';

import {
  Building2,
  ShieldCheck,
  UserPlus,
  UsersRound,
  Eye,
  EyeOff,
  User,
  AtSign,
  Phone,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiFetch } from '@/lib/api/client';
import { readAuthToken } from '@/lib/auth/session';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { UserRole } from '@/lib/types/dashboard';
import {
  AuthButton,
  AuthCheckbox,
  AuthInput,
  AuthNotice,
  AuthPanelHeader,
  AuthSelect,
  AuthShell,
  AuthTabs,
} from '@/components/auth/auth-ui';

const enableFullNameCapture = process.env.NEXT_PUBLIC_ENABLE_FULLNAME === '1';

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
  Record<
    | 'inviteToken'
    | 'fullName'
    | 'email'
    | 'phone'
    | 'password'
    | 'confirmPassword'
    | 'role'
    | 'terms',
    string
  >
>;

// Renders the account provisioning screen with access gating and validation.
export default function CreateAccountPage() {
  const { data: currentUser, isLoading, isError } = useCurrentUser();
  const [inviteToken, setInviteToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('DISPATCHER');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>('RIDER');
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState('');
  const [inviteTokenValue, setInviteTokenValue] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [touched, setTouched] = useState({
    inviteToken: false,
    fullName: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
    terms: false,
  });

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
  const inviteRoleOptions = useMemo(() => {
    if (!currentUser || !isAdminMode) {
      return roleOptions.filter((option) => option.value === 'RIDER');
    }
    if (currentUser.role === 'OWNER') {
      return roleOptions.filter((option) => option.value !== 'OWNER');
    }
    if (currentUser.role === 'ADMIN') {
      return roleOptions.filter(
        (option) => option.value !== 'OWNER' && option.value !== 'ADMIN',
      );
    }
    return roleOptions.filter((option) => option.value === 'RIDER');
  }, [currentUser, isAdminMode]);

  const accessNotice = useMemo(() => {
    if (isPublicMode) {
      return {
        tone: 'warning' as const,
        message: sessionInvalid
          ? 'Session expired. Sign in to create staff accounts, or continue with rider-only public sign-up.'
          : 'Public sign-up creates rider accounts only. Enter the invite code provided by your admin.',
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
  const inlineErrors = useMemo(
    () =>
      getRegisterFieldErrors({
        inviteToken,
        fullName,
        email,
        phone,
        password,
        confirmPassword,
        termsAccepted,
        touched,
        isPublicMode,
      }),
    [
      inviteToken,
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      termsAccepted,
      touched,
      isPublicMode,
    ],
  );
  const mergedErrors: FieldErrors = { ...inlineErrors, ...fieldErrors };

  useEffect(() => {
    if (!isAdminMode && role !== 'RIDER') {
      setRole('RIDER');
    }
  }, [isAdminMode, role]);

  // Keeps invite role aligned with the available role options.
  useEffect(() => {
    if (inviteRoleOptions.length === 0) {
      return;
    }
    if (!inviteRoleOptions.some((option) => option.value === inviteRole)) {
      setInviteRole(inviteRoleOptions[0]!.value);
    }
  }, [inviteRoleOptions, inviteRole]);

  // Validates inputs and calls the admin-only register endpoint for the current fleet.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSocialNotice(null);
    setSuccess(null);
    setFieldErrors({});
    setTouched((prev) => ({
      ...prev,
      inviteToken: true,
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      terms: true,
    }));

    if (fullName.trim().length < 2) {
      setFieldErrors({ fullName: 'Enter full name' });
      setError('Full name is required');
      return;
    }

    if (!termsAccepted) {
      setFieldErrors({ terms: 'Accept the terms to continue' });
      setError('Please accept the terms to continue');
      return;
    }

    if (isPublicMode) {
      const parsedToken = z
        .string()
        .min(12, 'Invite code is required')
        .safeParse(inviteToken.trim());
      if (!parsedToken.success) {
        setFieldErrors({ inviteToken: parsedToken.error.issues[0]?.message });
        setError(parsedToken.error.issues[0]?.message ?? 'Invite code is required');
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
          '/auth/register-invite',
          {
            method: 'POST',
            body: JSON.stringify({
              token: inviteToken.trim(),
              email: parsed.data.email,
              phone: parsed.data.phone,
              password: parsed.data.password,
              ...(enableFullNameCapture ? { fullName: fullName.trim() } : {}),
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
            ...(enableFullNameCapture ? { fullName: fullName.trim() } : {}),
          }),
        });
      }

      setSuccess(
        isPublicMode
          ? 'Account created. You can now sign in with your new credentials.'
          : 'Account created. Share the login credentials securely with the new operator.',
      );
      setInviteToken('');
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setTermsAccepted(false);
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

  // Generates a one-time invite token for fleet onboarding.
  const handleInviteCreate = async () => {
    setInviteError(null);
    setInviteTokenValue(null);
    setInviteExpiresAt(null);

    const trimmedHours = inviteExpiresInHours.trim();
    let expiresInHours: number | undefined;
    if (trimmedHours.length > 0) {
      const parsedHours = Number(trimmedHours);
      if (!Number.isFinite(parsedHours) || parsedHours < 1 || parsedHours > 720) {
        setInviteError('Expiry must be between 1 and 720 hours');
        return;
      }
      expiresInHours = parsedHours;
    }

    try {
      setInviteSubmitting(true);
      const response = await apiFetch<{
        token: string;
        expiresAt: string;
      }>('/auth/invites', {
        method: 'POST',
        body: JSON.stringify({
          role: inviteRole,
          expiresInHours,
        }),
      });

      setInviteTokenValue(response.token);
      setInviteExpiresAt(response.expiresAt);
      setInviteExpiresInHours('');
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError) {
        setInviteError(requestError.message);
      } else {
        setInviteError('Unable to generate invite right now');
      }
    } finally {
      setInviteSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Fleet identity"
      title="Create safe access for every rider and operator."
      subtitle="Provision accounts with the right roles and invite codes so each team member sees only the data they need."
      securityHint="Your data is सुरक्षित / secure"
      features={[
        {
          icon: <UserPlus size={16} />,
          title: 'Guided onboarding',
          description: 'Create riders or staff in minutes with clear role separation.',
        },
        {
          icon: <ShieldCheck size={16} />,
          title: 'Fleet isolation',
          description: 'Every account is tied to a single fleet with enforced RBAC.',
        },
        {
          icon: <Building2 size={16} />,
          title: 'Scales with growth',
          description: 'Add dispatchers, technicians, and admins as your network expands.',
        },
      ]}
    >
      <AuthPanelHeader
        eyebrow="Create account"
        title="Join Fleet OS"
        description="Fast onboarding for riders and operators. Admin roles require fleet approval."
      />
      <AuthTabs active="signup" />

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {accessNotice ? <AuthNotice message={accessNotice.message} tone={accessNotice.tone} /> : null}
        {error ? <AuthNotice message={error} tone="error" /> : null}
        {socialNotice ? <AuthNotice message={socialNotice} tone="warning" /> : null}
        {success ? <AuthNotice message={success} tone="success" /> : null}

        {isPublicMode ? (
          <AuthInput
            label="Invite code"
            placeholder="Paste invite code"
            value={inviteToken}
            onChange={(event) => setInviteToken(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, inviteToken: true }))}
            error={mergedErrors.inviteToken}
            disabled={isFormDisabled}
            icon={<UsersRound size={16} />}
          />
        ) : null}

        <AuthInput
          label="Full name"
          placeholder="e.g. Aisha N."
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
          error={mergedErrors.fullName}
          disabled={isFormDisabled}
          icon={<User size={16} />}
          helper={
            enableFullNameCapture
              ? 'Saved to your Fleet OS profile after account creation.'
              : 'Stored once profile capture is enabled on the backend.'
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthInput
            label="Email address"
            placeholder="operator@fleet.example"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            error={mergedErrors.email}
            disabled={isFormDisabled}
            icon={<AtSign size={16} />}
          />
          <AuthInput
            label="Phone number"
            placeholder="+2507..."
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
            error={mergedErrors.phone}
            disabled={isFormDisabled}
            icon={<Phone size={16} />}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthInput
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            error={mergedErrors.password}
            disabled={isFormDisabled}
            icon={<Lock size={16} />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-xs font-semibold text-[#0F172A]/60 transition hover:text-[#0F172A]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <AuthInput
            label="Confirm password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
            error={mergedErrors.confirmPassword}
            disabled={isFormDisabled}
            icon={<Lock size={16} />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="text-xs font-semibold text-[#0F172A]/60 transition hover:text-[#0F172A]"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
        </div>

        {isAdminMode ? (
          <AuthSelect
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            error={mergedErrors.role}
            disabled={isFormDisabled}
          >
            {availableRoles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} · {option.description}
              </option>
            ))}
          </AuthSelect>
        ) : (
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Role</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setRole('RIDER')}
                className="rounded-[14px] border border-[#22C55E]/40 bg-[#22C55E]/10 px-3 py-2 text-[#0F172A]"
              >
                Rider
              </button>
              <button
                type="button"
                disabled
                className="rounded-[14px] border border-[#0F172A]/10 bg-white px-3 py-2 text-[#0F172A]/40"
              >
                Admin
              </button>
            </div>
            <p className="mt-2 text-xs text-[#0F172A]/60">
              Admin roles require fleet approval and cannot be self-selected.
            </p>
          </div>
        )}

        <AuthCheckbox
          checked={termsAccepted}
          onChange={setTermsAccepted}
          label="I agree to the Terms & Conditions and Privacy Policy."
          disabled={isFormDisabled}
        />
        {mergedErrors.terms ? (
          <p className="text-xs font-medium text-rose-600">{mergedErrors.terms}</p>
        ) : null}

        <AuthButton
          type="submit"
          label={isSubmitting ? 'Creating account...' : 'Create account'}
          isLoading={isSubmitting}
          disabled={isFormDisabled}
        />

        <div className="flex items-center gap-3 text-xs text-[#0F172A]/40">
          <span className="h-px flex-1 bg-[#0F172A]/10" />
          <span>Or sign up with</span>
          <span className="h-px flex-1 bg-[#0F172A]/10" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthButton
            type="button"
            variant="secondary"
            label="Google"
            icon={<span className="text-base font-semibold">G</span>}
            onClick={() => handleSocialLogin('google', setSocialNotice)}
          />
          <AuthButton
            type="button"
            variant="secondary"
            label="Apple"
            icon={<span className="text-base font-semibold">A</span>}
            onClick={() => handleSocialLogin('apple', setSocialNotice)}
          />
        </div>

        <p className="text-center text-xs text-[#0F172A]/60">
          Already have credentials?{' '}
          <Link href="/login" className="font-semibold text-[#0F172A]">
            Return to login
          </Link>
        </p>
      </form>

      {isAdminMode ? (
        <div className="mt-6 rounded-[20px] border border-[#0F172A]/10 bg-white/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0F172A]/50">
            Invite codes
          </p>
          <p className="mt-2 text-xs leading-5 text-[#0F172A]/60">
            Generate a one-time invite token for operators who should self-register. Tokens are
            short-lived and should be shared securely.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AuthSelect
              label="Invite role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as UserRole)}
              disabled={inviteSubmitting}
            >
              {inviteRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AuthSelect>
            <AuthInput
              label="Expires in (hours)"
              placeholder="168"
              value={inviteExpiresInHours}
              onChange={(event) => setInviteExpiresInHours(event.target.value)}
              disabled={inviteSubmitting}
              icon={<ShieldCheck size={16} />}
            />
          </div>

          {inviteError ? <AuthNotice message={inviteError} tone="error" /> : null}
          {inviteTokenValue ? (
            <div className="mt-3 rounded-[16px] border border-[#0F172A]/10 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0F172A]/50">
                Invite code
              </p>
              <p className="mt-2 break-all font-mono text-xs text-[#0F172A]">
                {inviteTokenValue}
              </p>
              {inviteExpiresAt ? (
                <p className="mt-2 text-xs text-[#0F172A]/60">
                  Expires {new Date(inviteExpiresAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <AuthButton
            type="button"
            variant="secondary"
            label={inviteSubmitting ? 'Generating invite...' : 'Generate invite'}
            onClick={() => void handleInviteCreate()}
            disabled={inviteSubmitting}
            isLoading={inviteSubmitting}
          />
        </div>
      ) : null}
    </AuthShell>
  );
}

// Routes the user to the configured OAuth endpoint or displays a warning if unavailable.
function handleSocialLogin(
  provider: 'google' | 'apple',
  setNotice: (message: string | null) => void,
) {
  const oauthUrl =
    provider === 'google'
      ? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_URL
      : process.env.NEXT_PUBLIC_APPLE_OAUTH_URL;

  if (!oauthUrl) {
    setNotice('Social sign-up is not configured for this environment yet.');
    return;
  }

  window.location.href = oauthUrl;
}

// Computes validation errors for the sign-up form based on touch state.
function getRegisterFieldErrors({
  inviteToken,
  fullName,
  email,
  phone,
  password,
  confirmPassword,
  termsAccepted,
  touched,
  isPublicMode,
}: {
  inviteToken: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  touched: {
    inviteToken: boolean;
    fullName: boolean;
    email: boolean;
    phone: boolean;
    password: boolean;
    confirmPassword: boolean;
    terms: boolean;
  };
  isPublicMode: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (isPublicMode && touched.inviteToken && inviteToken.trim().length < 12) {
    errors.inviteToken = 'Invite code is required';
  }
  if (touched.fullName && fullName.trim().length < 2) {
    errors.fullName = 'Enter full name';
  }
  if (touched.email && email.trim().length > 0 && !z.string().email().safeParse(email).success) {
    errors.email = 'Enter a valid email';
  }
  if (touched.phone && phone.trim().length > 0 && phone.trim().length < 6) {
    errors.phone = 'Enter a valid phone number';
  }
  if ((touched.email || touched.phone) && !email.trim() && !phone.trim()) {
    errors.email = 'Provide either email or phone';
  }
  if (touched.password && password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (touched.confirmPassword && confirmPassword.length > 0 && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match';
  }
  if (touched.terms && !termsAccepted) {
    errors.terms = 'Accept the terms to continue';
  }
  return errors;
}
