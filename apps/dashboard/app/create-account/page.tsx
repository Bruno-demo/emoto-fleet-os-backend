'use client';

import {
  BadgeCheck,
  Bike,
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
  ArrowLeft,
  Zap,
  X,
} from 'lucide-react';
import { compressImage } from '@/lib/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiFetch } from '@/lib/api/client';
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
import { cx } from '@/lib/ui';


const enableFullNameCapture = process.env.NEXT_PUBLIC_ENABLE_FULLNAME === '1';

const PLAN_DETAILS: Record<string, { title: string; price: string; period: string; description: string; icon: React.ReactNode }> = {
  'safety-core': { 
    title: 'Safety Core', 
    price: '5,000 RWF', 
    period: '/ bike / mo', 
    description: 'Essential safety (+ 20,000 RWF setup).',
    icon: <ShieldCheck size={18} />
  },
  'operations-plus': { 
    title: 'Operations Plus', 
    price: '10,000 RWF', 
    period: '/ bike / mo', 
    description: 'Advanced fleet ops (+ 20,000 RWF setup).',
    icon: <Zap size={18} />
  },
  enterprise: { 
    title: 'Enterprise', 
    price: 'Custom', 
    period: '', 
    description: 'Custom solutions for large fleets.',
    icon: <Building2 size={18} />
  },
};

type SignupType = 'rider' | 'admin';

const BIKE_RANGE_OPTIONS = [
  { value: '1-10', label: '1 – 10 bikes' },
  { value: '11-50', label: '11 – 50 bikes' },
  { value: '51-200', label: '51 – 200 bikes' },
  { value: '201-500', label: '201 – 500 bikes' },
  { value: '500+', label: '500+ bikes' },
];

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
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}>
      <CreateAccountInner />
    </Suspense>
  );
}

function CreateAccountInner() {
  const hasWindow = typeof window !== 'undefined';
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlugFromUrl = searchParams.get('plan');
  const flow = searchParams.get('flow');
  const tokenFromUrl = searchParams.get('token');
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(planSlugFromUrl);
  
  const selectedPlan = selectedPlanSlug ? PLAN_DETAILS[selectedPlanSlug] : null;
  const isDemo = flow === 'demo';
  const { data: currentUser, isLoading, isError } = useCurrentUser();
  const [signupType, setSignupType] = useState<SignupType>(tokenFromUrl ? 'rider' : planSlugFromUrl ? 'admin' : 'rider');
  const [inviteToken, setInviteToken] = useState(tokenFromUrl ?? '');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [passportPhoto, setPassportPhoto] = useState('');
  const [licencePhoto, setLicencePhoto] = useState('');
  const [identityCardPhoto, setIdentityCardPhoto] = useState('');
  const [isCompresingPassport, setIsCompresingPassport] = useState(false);
  const [isCompresingLicence, setIsCompresingLicence] = useState(false);
  const [isCompresingIdCard, setIsCompresingIdCard] = useState(false);
  const [role, setRole] = useState<UserRole>(planSlugFromUrl ? 'ADMIN' : 'DISPATCHER');
  const [fleetName, setFleetName] = useState('');
  const [bikeRange, setBikeRange] = useState('11-50');
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
    inviteToken: Boolean(tokenFromUrl),
    fullName: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
    terms: false,
  });

  const [otpCode, setOtpCode] = useState('');
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const isGateLocked = email.trim().length > 0 && !isEmailVerified;

  const registrationMode = useMemo(() => {
    if (!hasWindow) {
      return 'checking';
    }
    if (isError) {
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
  }, [hasWindow, isError, isLoading, currentUser]);

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
  }, [isChecking, isLimitedMode]);

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
        signupType,
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
      signupType,
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

  const sendOtpCode = async () => {
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await apiFetch<{ otp?: string }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), reason: 'register' }),
      }, { auth: false });
      
      setIsEmailOtpSent(true);
      if (res.otp) {
        setDevOtp(res.otp);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFieldErrors((prev) => ({ ...prev, email: 'This email is already taken. Please try another or sign in.' }));
          setError('This email is already taken. Please try another or sign in.');
        } else {
          setOtpError(err.message);
          setError(err.message);
        }
      } else {
        setOtpError('Failed to send OTP code');
        setError('Failed to send OTP code');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp: otpCode.trim(), reason: 'register' }),
      }, { auth: false });

      setIsEmailVerified(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setOtpError(err.message);
      } else {
        setOtpError('Invalid or expired OTP code');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleEmailBlur = async () => {
    setTouched((prev) => ({ ...prev, email: true }));
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!z.string().email().safeParse(trimmed).success) return;

    if (isEmailVerified || isSendingOtp || isEmailOtpSent) return;

    await sendOtpCode();
  };

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

    // Rider public signup requires invite code
    if (isPublicMode && signupType === 'rider') {
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

    // Admin public signup requires fleet name and plan
    if (isPublicMode && signupType === 'admin') {
      if (fleetName.trim().length < 2) {
        setError('Fleet name is required');
        return;
      }
      if (!selectedPlan && !isDemo) {
        setError('Please select a pricing plan to continue');
        // Scroll to the top to see the banner
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (isPublicMode && signupType === 'admin') {
        // Admin flow: create new fleet + admin user
        await apiFetch(
          '/auth/register-fleet',
          {
            method: 'POST',
            body: JSON.stringify({
              fleetName: fleetName.trim(),
              bikeRange,
              email: parsed.data.email,
              phone: parsed.data.phone,
              password: parsed.data.password,
              plan: selectedPlanSlug === 'safety-core' ? 'DEMO' : 'PREMIUM',
            }),
          },
          { auth: false },
        );
      } else if (isPublicMode && signupType === 'rider') {
        // Rider flow: redeem invite token
        await apiFetch(
          '/auth/register-invite',
          {
            method: 'POST',
            body: JSON.stringify({
              token: inviteToken.trim(),
              email: parsed.data.email,
              phone: parsed.data.phone,
              password: parsed.data.password,
              fullName: fullName.trim(),
              licenceNumber: licenceNumber.trim() || undefined,
              identityNumber: identityNumber.trim() || undefined,
              passportPhoto: passportPhoto || undefined,
              licencePhoto: licencePhoto || undefined,
              identityCardPhoto: identityCardPhoto || undefined,
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
          ? 'Account created! Redirecting to sign in...'
          : 'Account created. Share the login credentials securely with the new operator.',
      );

      // Redirect based on flow
      if (isDemo) {
        if (selectedPlanSlug && selectedPlan) {
          setTimeout(() => router.push(`/login?next=${encodeURIComponent(`/checkout?plan=${selectedPlanSlug}`)}`), 1500);
        } else {
          setTimeout(() => router.push('/login?next=/live'), 1500);
        }
      } else if (isPublicMode) {
        setTimeout(() => router.push('/registration-success'), 1500);
      }

      setInviteToken('');
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setFleetName('');
      setBikeRange('11-50');
      setTermsAccepted(false);
      setRole('DISPATCHER');
      setLicenceNumber('');
      setIdentityNumber('');
      setPassportPhoto('');
      setLicencePhoto('');
      setIdentityCardPhoto('');
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
      securityHint="Your data is secure"
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

      {signupType === 'admin' && !isDemo && isPublicMode && (
        <div className="mt-6 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted px-1">
            Choose your fleet plan
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(PLAN_DETAILS).map(([slug, plan]) => {
              const isSelected = selectedPlanSlug === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => setSelectedPlanSlug(slug)}
                  className={cx(
                    'group relative flex flex-col items-start rounded-[20px] border p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]',
                    isSelected 
                      ? 'border-accent bg-accent/[0.07] ring-1 ring-accent' 
                      : 'border-line bg-surface hover:border-line-hover'
                  )}
                >
                  <div className={cx(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                    isSelected ? 'bg-accent/20 text-accent' : 'bg-surface-muted text-ink-soft group-hover:text-ink'
                  )}>
                    {plan.icon}
                  </div>
                  
                  <div className="mt-3">
                    <p className={cx(
                      'text-sm font-bold',
                      isSelected ? 'text-ink' : 'text-ink-muted'
                    )}>
                      {plan.title}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-ink-soft">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-sm font-extrabold text-ink">{plan.price}</span>
                    <span className="text-[10px] text-ink-muted">{plan.period}</span>
                  </div>

                  {isSelected && (
                    <div className="absolute top-3 right-3 text-accent">
                      <BadgeCheck size={16} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isDemo && !selectedPlan && (
        <div className="mt-4 rounded-[16px] border border-purple-500/30 bg-purple-500/[0.07] p-4 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
            <UserPlus size={16} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">Demo request</p>
            <p className="text-sm text-ink-soft">Create your account to access a guided demo of Fleet OS.</p>
          </div>
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {accessNotice ? <AuthNotice message={accessNotice.message} tone={accessNotice.tone} /> : null}
        {error ? <AuthNotice message={error} tone="error" /> : null}
        {socialNotice ? <AuthNotice message={socialNotice} tone="warning" /> : null}
        {success ? <AuthNotice message={success} tone="success" /> : null}

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
            label={
              <span className="flex items-center justify-between w-full">
                <span>Email address</span>
                {isEmailVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success-ink bg-success/15 rounded-full px-2 py-0.5 border border-success/30 animate-in fade-in zoom-in-95 duration-200">
                    <BadgeCheck size={12} className="text-success-ink" /> Verified
                  </span>
                )}
              </span>
            }
            placeholder="operator@fleet.example"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setIsEmailOtpSent(false);
              setIsEmailVerified(false);
              setOtpCode('');
              setDevOtp(null);
              setOtpError(null);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
              setError(null);
            }}
            onBlur={handleEmailBlur}
            error={mergedErrors.email}
            disabled={isFormDisabled}
            icon={<AtSign size={16} />}
            rightElement={
              isSendingOtp ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : null
            }
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

        {isEmailOtpSent && !isEmailVerified && (
          <div className="rounded-[20px] border border-accent/20 bg-accent/[0.03] p-4 space-y-3 transition-all animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                Email Verification
              </p>
              {devOtp && (
                <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20">
                  Dev Mode OTP: {devOtp}
                </span>
              )}
            </div>
            
            <p className="text-xs text-ink-muted leading-relaxed">
              We have sent a 6-digit verification code to <span className="font-semibold text-ink">{email}</span>. Please enter it below to proceed.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-[14px] border border-line bg-surface px-4 py-2.5 text-center font-mono text-sm tracking-[0.3em] text-ink placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                  disabled={isVerifyingOtp}
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otpCode.length !== 6 || isVerifyingOtp}
                className="flex items-center justify-center rounded-[14px] bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                style={{ background: '#3B82F6', color: 'white' }}
              >
                {isVerifyingOtp ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Verify OTP'
                )}
              </button>
            </div>

            {otpError && (
              <p className="text-xs font-semibold text-danger-ink">
                {otpError}
              </p>
            )}

            <div className="flex justify-between items-center text-[10px] text-ink-muted">
              <span>{"Didn't receive the code?"}</span>
              <button
                type="button"
                onClick={sendOtpCode}
                className="font-bold text-accent hover:underline"
                disabled={isSendingOtp}
              >
                {isSendingOtp ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthInput
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            error={mergedErrors.password}
            disabled={isFormDisabled || isGateLocked}
            icon={<Lock size={16} />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-xs font-semibold text-ink-muted transition hover:text-ink"
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
            disabled={isFormDisabled || isGateLocked}
            icon={<Lock size={16} />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="text-xs font-semibold text-ink-muted transition hover:text-ink"
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
            disabled={isFormDisabled || isGateLocked}
          >
            {availableRoles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} · {option.description}
              </option>
            ))}
          </AuthSelect>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-ink">I am a</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setSignupType('rider'); setRole('RIDER'); }}
                  disabled={isFormDisabled || isGateLocked}
                  className={`flex items-center justify-center gap-2 rounded-[14px] px-3 py-2.5 transition-all ${
                    signupType === 'rider'
                      ? 'border-2 border-accent bg-accent/10 text-accent shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                      : 'border border-line bg-surface text-ink-muted hover:bg-surface-hover'
                  } disabled:opacity-50`}
                >
                  <Bike size={14} /> Rider
                </button>
                <button
                  type="button"
                  onClick={() => { setSignupType('admin'); setRole('ADMIN'); }}
                  disabled={isFormDisabled || isGateLocked}
                  className={`flex items-center justify-center gap-2 rounded-[14px] px-3 py-2.5 transition-all ${
                    signupType === 'admin'
                      ? 'border-2 border-accent bg-accent/10 text-accent shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                      : 'border border-line bg-surface text-ink-muted hover:bg-surface-hover'
                  } disabled:opacity-50`}
                >
                  <ShieldCheck size={14} /> Fleet Admin
                </button>
              </div>
            </div>

            {signupType === 'rider' && (
              <>
                <AuthInput
                  label="Invite code"
                  placeholder="Paste the code from your fleet admin"
                  value={inviteToken}
                  onChange={(event) => setInviteToken(event.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, inviteToken: true }))}
                  error={mergedErrors.inviteToken}
                  disabled={isFormDisabled || isGateLocked}
                  icon={<UsersRound size={16} />}
                  helper="Ask your fleet admin for an invite code to join their fleet."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <AuthInput
                    label="Driving licence number"
                    placeholder="e.g. DL-12345"
                    value={licenceNumber}
                    onChange={(event) => setLicenceNumber(event.target.value)}
                    disabled={isFormDisabled || isGateLocked}
                    icon={<User size={16} />}
                  />
                  <AuthInput
                    label="Identity card number"
                    placeholder="e.g. ID-54321"
                    value={identityNumber}
                    onChange={(event) => setIdentityNumber(event.target.value)}
                    disabled={isFormDisabled || isGateLocked}
                    icon={<ShieldCheck size={16} />}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mt-4">
                  {/* Passport Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Passport Photo</label>
                    {passportPhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[100px]">
                        <img src={passportPhoto} alt="Passport" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPassportPhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-muted p-3 cursor-pointer hover:border-accent/30 transition h-[100px]">
                        <span className="text-lg mb-0.5">👤</span>
                        <span className="text-[9px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingPassport ? 'Compressing...' : 'Passport Photo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isCompresingPassport || isFormDisabled || isGateLocked}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsCompresingPassport(true);
                                const compressed = await compressImage(file);
                                setPassportPhoto(compressed);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsCompresingPassport(false);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Licence Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Licence Photo</label>
                    {licencePhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[100px]">
                        <img src={licencePhoto} alt="Licence" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setLicencePhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-muted p-3 cursor-pointer hover:border-accent/30 transition h-[100px]">
                        <span className="text-lg mb-0.5">💳</span>
                        <span className="text-[9px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingLicence ? 'Compressing...' : 'Licence Photo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isCompresingLicence || isFormDisabled || isGateLocked}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsCompresingLicence(true);
                                const compressed = await compressImage(file);
                                setLicencePhoto(compressed);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsCompresingLicence(false);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* ID Card Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">National ID Photo</label>
                    {identityCardPhoto ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden h-[100px]">
                        <img src={identityCardPhoto} alt="ID Card" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setIdentityCardPhoto('')}
                          className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-muted p-3 cursor-pointer hover:border-accent/30 transition h-[100px]">
                        <span className="text-lg mb-0.5">🆔</span>
                        <span className="text-[9px] font-semibold text-ink-muted text-center leading-tight">
                          {isCompresingIdCard ? 'Compressing...' : 'ID Card Photo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isCompresingIdCard || isFormDisabled || isGateLocked}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsCompresingIdCard(true);
                                const compressed = await compressImage(file);
                                setIdentityCardPhoto(compressed);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsCompresingIdCard(false);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </>
            )}

            {signupType === 'admin' && (
              <div className="space-y-3">
                <AuthInput
                  label="Fleet name"
                  placeholder="e.g. Kigali Express Fleet"
                  value={fleetName}
                  onChange={(event) => setFleetName(event.target.value)}
                  disabled={isFormDisabled || isGateLocked}
                  icon={<Building2 size={16} />}
                />
                <AuthSelect
                  label="Fleet size"
                  value={bikeRange}
                  onChange={(event) => setBikeRange(event.target.value)}
                  disabled={isFormDisabled || isGateLocked}
                >
                  {BIKE_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </AuthSelect>
              </div>
            )}
          </>
        )}

        <AuthCheckbox
          checked={termsAccepted}
          onChange={setTermsAccepted}
          label="I agree to the Terms & Conditions and Privacy Policy."
          disabled={isFormDisabled || isGateLocked}
        />
        {mergedErrors.terms ? (
          <p className="text-xs font-medium text-danger-ink">{mergedErrors.terms}</p>
        ) : null}

        <AuthButton
          type="submit"
          label={isSubmitting ? 'Creating account...' : 'Create account'}
          isLoading={isSubmitting}
          disabled={isFormDisabled || isGateLocked}
        />

        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-line" />
          <span>Or sign up with</span>
          <span className="h-px flex-1 bg-line" />
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

        <p className="text-center text-xs text-ink-muted">
          Already have credentials?{' '}
          <Link href="/login" className="font-semibold text-ink">
            Return to login
          </Link>
        </p>
      </form>

      {isAdminMode ? (
        <div className="mt-6 rounded-[20px] border border-line bg-surface-muted p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Invite codes
          </p>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
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
            <div className="mt-3 rounded-[16px] border border-line bg-surface px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Invite code
              </p>
              <p className="mt-2 break-all font-mono text-xs text-ink">
                {inviteTokenValue}
              </p>
              {inviteExpiresAt ? (
                <p className="mt-2 text-xs text-ink-muted">
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
  signupType,
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
  signupType: SignupType;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (isPublicMode && signupType === 'rider' && touched.inviteToken && inviteToken.trim().length < 12) {
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

