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
  Zap,
  X,
  Navigation2,
  Activity,
  Banknote,
  Truck,
  Send,
  CheckCircle,
  MessageSquare,
  Briefcase,
  Hash,
} from 'lucide-react';
import { compressImage } from '@/lib/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTranslation } from '@/components/i18n/LanguageProvider';


interface PromoDiscount {
  id: string;
  name: string;
  code: string | null;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  appliesTo: 'SETUP_FEE' | 'SUBSCRIPTION' | 'BOTH';
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  fleetId: string | null;
  isActive: boolean;
}

interface PricingTier {
  id: string;
  name: string;
  planCode: string;
  monthlyRatePerBike: number;
  setupFeePerBike: number;
  description: string | null;
  isActive: boolean;
}

const enableFullNameCapture = process.env.NEXT_PUBLIC_ENABLE_FULLNAME === '1';

const RWANDA_INSURERS = [
  'Radiant',
  'Prime',
  'Sanlam',
  'Sonarwa',
  'Britam',
  'Mayfair',
  'Cogear',
  'Phoenix',
];

const PLAN_DETAILS: Record<
  string,
  {
    title: string;
    price: string;
    period: string;
    description: string;
    setupFeePerBike: number;
    icon: React.ReactNode;
  }
> = {
  payg: { 
    title: 'Pay-As-You-Go', 
    price: '350 RWF / day', 
    period: 'per active bike', 
    description: 'Pay per active bike on your fleet with 0 RWF setup fee.',
    setupFeePerBike: 0,
    icon: <Zap size={18} />
  },
  insurance: {
    title: 'Insurance & Compliance',
    price: 'Custom Quote',
    period: 'Contact Sales',
    description: 'For insurers, risk compliance & FNOL evidence packs.',
    setupFeePerBike: 0,
    icon: <ShieldCheck size={18} />
  },
  enterprise: {
    title: 'Enterprise Operations',
    price: 'Custom Quote',
    period: 'Contact Sales',
    description: 'Multi-fleet HQ command center, SLAs & custom IoT.',
    setupFeePerBike: 0,
    icon: <Building2 size={18} />
  },
};

type SignupType = 'admin';

const BIKE_RANGE_OPTIONS = [
  { value: '1-10', label: '1 – 10 bikes' },
  { value: '11-50', label: '11 – 50 bikes' },
  { value: '51-200', label: '51 – 200 bikes' },
  { value: '201-500', label: '201 – 500 bikes' },
  { value: '500+', label: '500+ bikes' },
];

const registerFormSchema = z
  .object({
    email: z.string().min(1, 'email_error').email('email_invalid_error'),
    phone: z
      .string()
      .optional()
      .refine((val) => !val || /^07\d{8}$/.test(val.trim()), {
        message: 'phone_error',
      })
      .transform((val) => {
        if (!val) return undefined;
        const trimmed = val.trim();
        if (!trimmed) return undefined;
        return '+250' + trimmed.slice(1);
      }),
    password: z.string().min(8, 'password_error'),
    confirmPassword: z.string().min(8, 'confirm_password_label'),
    role: z.enum(['ADMIN', 'DISPATCHER', 'TECH', 'RIDER']),
  })
  .superRefine((data, context) => {
    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'passwords_match_error',
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
  const { t } = useTranslation();
  const hasWindow = typeof window !== 'undefined';
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlugFromUrl = searchParams.get('plan');
  const flow = searchParams.get('flow');
  const tokenFromUrl = searchParams.get('token');
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(planSlugFromUrl);
  
  const [plans, setPlans] = useState(PLAN_DETAILS);
  const [isPricingLoaded, setIsPricingLoaded] = useState(false);
  const selectedPlan = selectedPlanSlug ? plans[selectedPlanSlug] : null;

  useEffect(() => {
    const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
    async function loadPricing() {
      try {
        const res = await fetch(`${API_BASE_URL}/billing/pricing`);
        if (!res.ok) return;
        const tiers = (await res.json()) as PricingTier[];
        const updatedPlans = { ...PLAN_DETAILS };
        
        const paygTier = tiers.find(t => t.planCode === 'PAYG');
        if (paygTier) {
          const planData = {
            title: 'Cooperative & Individual',
            price: '350 RWF',
            period: '/ bike / active day',
            description: 'Cooperative & individual fleet tracking (350 RWF/day, 0 RWF setup fee).',
            setupFeePerBike: 0,
            icon: <UsersRound size={18} />
          };
          updatedPlans['coop-individual'] = planData;
          updatedPlans['safety-core'] = planData;

          const deliveryPlanData = {
            title: 'Commercial Delivery',
            price: '500 RWF',
            period: '/ bike / active day',
            description: 'High-volume commercial delivery fleet ops (500 RWF/day, 0 RWF setup fee).',
            setupFeePerBike: 0,
            icon: <Truck size={18} />
          };
          updatedPlans['delivery'] = deliveryPlanData;
          updatedPlans['operations-plus'] = deliveryPlanData;
        }
 
        const insuranceTier = tiers.find(t => t.planCode === 'INSURANCE');
        if (insuranceTier) {
          updatedPlans['insurance'] = {
            title: 'Insurance Partner',
            price: insuranceTier.monthlyRatePerBike === 0 ? 'Custom' : `${insuranceTier.monthlyRatePerBike.toLocaleString()} RWF`,
            period: '',
            description: 'For insurance companies & risk management partners.',
            setupFeePerBike: insuranceTier.setupFeePerBike,
            icon: <Building2 size={18} />
          };
        }
        
        setPlans(updatedPlans);
        setIsPricingLoaded(true);
      } catch (err) {
        console.error('Failed to load dynamic pricing in registration:', err);
      }
    }
    loadPricing();
  }, []);
  const isDemo = flow === 'demo';
  const { data: currentUser, isLoading, isError } = useCurrentUser();
  const [signupType] = useState<SignupType>('admin');
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
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [fleetName, setFleetName] = useState('');
  const [fleetType, setFleetType] = useState<'COOP' | 'DELIVERY' | 'PERSONAL'>('COOP');
  const [bikeRange, setBikeRange] = useState('11-50');
  const [insurerName, setInsurerName] = useState('');
  const [customInsurerName, setCustomInsurerName] = useState('');
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

  // Promo code states
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<PromoDiscount | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Quote request modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteType, setQuoteType] = useState<'enterprise' | 'insurance'>('enterprise');
  const [quoteName, setQuoteName] = useState('');
  const [quoteEmail, setQuoteEmail] = useState('');
  const [quotePhone, setQuotePhone] = useState('');
  const [quoteCompany, setQuoteCompany] = useState('');
  const [quoteFleetSize, setQuoteFleetSize] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const openQuoteModal = useCallback((type: 'enterprise' | 'insurance') => {
    setQuoteType(type);
    setQuoteName('');
    setQuoteEmail('');
    setQuotePhone('');
    setQuoteCompany('');
    setQuoteFleetSize('');
    setQuoteMessage('');
    setQuoteError(null);
    setQuoteSuccess(false);
    setShowQuoteModal(true);
  }, []);

  const handleQuoteSubmit = useCallback(async () => {
    if (!quoteName.trim() || !quoteEmail.trim()) {
      setQuoteError('Please provide your name and email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quoteEmail.trim())) {
      setQuoteError('Please enter a valid email address.');
      return;
    }
    setQuoteSubmitting(true);
    setQuoteError(null);
    try {
      const category = quoteType === 'enterprise' ? 'Enterprise Quote Request' : 'Insurance Partner Quote Request';
      const messageParts = [
        `Plan: ${quoteType === 'enterprise' ? 'Enterprise Operations (100+ bikes)' : 'Insurance & Compliance Partner'}`,
        quoteCompany.trim() ? `Company: ${quoteCompany.trim()}` : null,
        quotePhone.trim() ? `Phone: ${quotePhone.trim()}` : null,
        quoteFleetSize.trim() ? `Fleet Size: ${quoteFleetSize.trim()} bikes` : null,
        '',
        quoteMessage.trim() || 'No additional message provided.',
      ].filter(Boolean).join('\n');

      await apiFetch('/auth/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: quoteName.trim(),
          email: quoteEmail.trim(),
          category,
          message: messageParts,
        }),
      }, { auth: false });
      setQuoteSuccess(true);
    } catch {
      setQuoteError('Failed to submit your request. Please try again or email us directly at bruno@emotofleet.com.');
    } finally {
      setQuoteSubmitting(false);
    }
  }, [quoteName, quoteEmail, quotePhone, quoteCompany, quoteFleetSize, quoteMessage, quoteType]);

  const handleValidatePromo = async () => {
    if (!promoCode) return;
    setIsValidatingPromo(true);
    setPromoError(null);
    try {
      const res = await apiFetch<PromoDiscount>(`/billing/public/validate-discount?code=${encodeURIComponent(promoCode)}`);
      setAppliedDiscount(res);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid promo code';
      setPromoError(errorMsg);
      setAppliedDiscount(null);
    } finally {
      setIsValidatingPromo(false);
    }
  };

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
  const mergedErrors: FieldErrors = useMemo(() => {
    const merged: FieldErrors = {};
    (Object.keys(inlineErrors) as Array<keyof FieldErrors>).forEach((k) => {
      if (inlineErrors[k]) merged[k] = t(inlineErrors[k]!);
    });
    (Object.keys(fieldErrors) as Array<keyof FieldErrors>).forEach((k) => {
      if (fieldErrors[k]) merged[k] = t(fieldErrors[k]!);
    });
    return merged;
  }, [inlineErrors, fieldErrors, t]);

  useEffect(() => {
    if (!isAdminMode && role !== 'RIDER') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole('RIDER');
    }
  }, [isAdminMode, role]);

  // Keeps invite role aligned with the available role options.
  useEffect(() => {
    if (inviteRoleOptions.length === 0) {
      return;
    }
    if (!inviteRoleOptions.some((option) => option.value === inviteRole)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setFieldErrors({ fullName: 'full_name_error' });
      setError(t('full_name_error', 'Full name is required'));
      return;
    }

    if (!termsAccepted) {
      setFieldErrors({ terms: 'terms_error' });
      setError(t('terms_accept_error', 'Please accept the terms to continue'));
      return;
    }

    // Rider public signup via invite code is disabled on the web dashboard.
    // Riders must use the mobile app or be created by an admin in /riders.

    let finalFleetName = fleetName.trim();
    let finalInsurerName = selectedPlanSlug === 'insurance' ? insurerName : undefined;

    // Admin public signup requires fleet name and plan
    if (isPublicMode && signupType === 'admin') {
      if (selectedPlanSlug === 'insurance') {
        if (!insurerName) {
          setError(t('select_insurance_error', 'Please select your insurance company'));
          return;
        }
        if (insurerName === 'Other') {
          if (!customInsurerName.trim()) {
            setError(t('enter_insurance_name_error', 'Please enter your insurance company name'));
            return;
          }
          finalInsurerName = customInsurerName.trim();
          finalFleetName = customInsurerName.trim();
        } else {
          finalInsurerName = insurerName;
          finalFleetName = insurerName;
        }
      } else {
        if (fleetName.trim().length < 2) {
          setError(t('fleet_name_required_error', 'Fleet name is required'));
          return;
        }
        if (!selectedPlan && !isDemo) {
          setError(t('select_plan_error', 'Please select a pricing plan to continue'));
          // Scroll to the top to see the banner
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    const parsed = registerFormSchema.safeParse({
      email: email.trim(),
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
      setError(parsed.error.issues[0]?.message ? t(parsed.error.issues[0].message) : t('review_inputs_error', 'Please review the form inputs'));
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
              fleetName: finalFleetName,
              bikeRange,
              email: parsed.data.email,
              phone: parsed.data.phone,
              password: parsed.data.password,
              plan: 'PAYG',
              fleetType: selectedPlanSlug === 'insurance' ? undefined : fleetType,
              insurerName: finalInsurerName,
              fullName: fullName.trim() || undefined,
              promoCode: appliedDiscount ? promoCode : undefined,
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
            fullName: fullName.trim() || undefined,
          }),
        });
      }

      setSuccess(
        isPublicMode
          ? t('account_created_redirecting', 'Account created! Redirecting to sign in...')
          : t('account_created_operator', 'Account created. Share the login credentials securely with the new operator.'),
      );

      // Redirect based on flow
      if (isDemo) {
        if (selectedPlanSlug && selectedPlan) {
          setTimeout(() => router.push(`/checkout?plan=${selectedPlanSlug}`), 1500);
        } else {
          setTimeout(() => router.push('/live'), 1500);
        }
      } else if (isPublicMode) {
        const selectedRangeLabel = BIKE_RANGE_OPTIONS.find(o => o.value === bikeRange)?.label ?? bikeRange;
        const successUrl = selectedPlanSlug === 'insurance'
          ? '/registration-success?type=insurance'
          : `/registration-success?fleet=${encodeURIComponent(finalFleetName)}&size=${encodeURIComponent(selectedRangeLabel)}`;
        setTimeout(() => router.push(successUrl), 1500);
      }

      setInviteToken('');
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setFleetName('');
      setFleetType('COOP');
      setInsurerName('');
      setCustomInsurerName('');
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
        setError(t('register_failed_error', 'Unable to create an account right now'));
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
        setInviteError(t('expiry_hours_error', 'Expiry must be between 1 and 720 hours'));
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
        setInviteError(t('invite_failed_error', 'Unable to generate invite right now'));
      }
    } finally {
      setInviteSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t('fleet_identity_eyebrow', 'Fleet identity')}
      title={t('create_access_title', 'Create safe access for every rider and operator.')}
      subtitle={t('create_access_subtitle', 'Provision accounts with the right roles and invite codes so each team member sees only the data they need.')}
      securityHint={t('data_secure_hint', 'Your data is secure')}
      features={[
        {
          icon: <UserPlus size={16} />,
          title: t('onboarding_title', 'Guided onboarding'),
          description: t('onboarding_desc', 'Create riders or staff in minutes with clear role separation.'),
        },
        {
          icon: <Navigation2 size={16} />,
          title: t('telemetry_title', 'Realtime telemetry'),
          description: t('telemetry_desc', 'Track speed, battery, and trip activity with live fleet visibility.'),
        },
        {
          icon: <Activity size={16} />,
          title: t('incident_dispatch_title', 'Incident response'),
          description: t('incident_dispatch_desc', 'Handle crashes and SOS alerts with guided workflows.'),
        },
        {
          icon: <ShieldCheck size={16} />,
          title: t('fleet_isolation_title', 'Fleet isolation'),
          description: t('fleet_isolation_desc', 'Every account is tied to a single fleet with enforced RBAC.'),
        },
        {
          icon: <Building2 size={16} />,
          title: t('scales_growth_title', 'Scales with growth'),
          description: t('scales_growth_desc', 'Add dispatchers, technicians, and admins as your network expands.'),
        },
        {
          icon: <Banknote size={16} />,
          title: t('billing_automation_title', 'Automated billing'),
          description: t('billing_automation_desc', 'Centralized settings for cycles, grace periods, and custom coupons.'),
        },
      ]}
    >
      <AuthPanelHeader
        eyebrow={t('create_account_eyebrow', 'Create account')}
        title={t('join_fleet_os_title', 'Join Fleet OS')}
        description={t('join_fleet_os_desc', 'Fast onboarding for riders and operators. Admin roles require fleet approval.')}
      />
      <AuthTabs active="signup" />

      {/* Single Unified Fleet Type & Subscription Plan Selection happens inside the Form below */}

      {isDemo && !selectedPlan && (
        <div className="mt-4 rounded-[16px] border border-purple-500/30 bg-purple-500/[0.07] p-4 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
            <UserPlus size={16} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">{t('demo_request_title', 'Demo request')}</p>
            <p className="text-sm text-ink-soft">{t('demo_request_desc', 'Create your account to access a guided demo of Fleet OS.')}</p>
          </div>
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {accessNotice ? <AuthNotice message={accessNotice.message} tone={accessNotice.tone} /> : null}
        {error ? <AuthNotice message={error} tone="error" /> : null}
        {socialNotice ? <AuthNotice message={socialNotice} tone="warning" /> : null}
        {success ? <AuthNotice message={success} tone="success" /> : null}

        <AuthInput
          label={t('full_name_label')}
          placeholder={t('full_name_placeholder', 'e.g. Aisha N.')}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
          error={mergedErrors.fullName}
          disabled={isFormDisabled}
          icon={<User size={16} />}
          helper={
            enableFullNameCapture
              ? t('fullname_saved_helper')
              : t('fullname_stored_helper')
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthInput
            label={
              <span className="flex items-center justify-between w-full">
                <span>{t('email_label')}</span>
                {isEmailVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success-ink bg-success/15 rounded-full px-2 py-0.5 border border-success/30 animate-in fade-in zoom-in-95 duration-200">
                    <BadgeCheck size={12} className="text-success-ink" /> {t('email_verified')}
                  </span>
                )}
              </span>
            }
            placeholder={t('email_placeholder', 'operator@fleet.example')}
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
            label={t('phone_label')}
            placeholder={t('phone_placeholder', '07...')}
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
                {t('email_verification')}
              </p>
              {devOtp && (
                <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20">
                  Dev Mode OTP: {devOtp}
                </span>
              )}
            </div>
            
            <p className="text-xs text-ink-muted leading-relaxed">
              {t('email_verification_desc').replace('{email}', email)}
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={6}
                  placeholder={t('enter_otp_placeholder', 'Enter 6-digit OTP')}
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
                  t('verify_otp_btn')
                )}
              </button>
            </div>

            {otpError && (
              <p className="text-xs font-semibold text-danger-ink">
                {otpError}
              </p>
            )}

            <div className="flex justify-between items-center text-[10px] text-ink-muted">
              <span>{t('no_code_prompt')}</span>
              <button
                type="button"
                onClick={sendOtpCode}
                className="font-bold text-accent hover:underline"
                disabled={isSendingOtp}
              >
                {isSendingOtp ? t('sending_code_btn') : t('resend_code_btn')}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthInput
            label={t('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder={t('password_placeholder', 'Minimum 8 characters')}
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
            label={t('confirm_password_label')}
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder={t('confirm_password_placeholder', 'Re-enter password')}
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
            label={t('invite_role_label')}
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            error={mergedErrors.role}
            disabled={isFormDisabled || isGateLocked}
          >
            {availableRoles.map((option) => (
              <option key={option.value} value={option.value}>
                {t(`role_${option.value.toLowerCase()}`)} · {t(`role_${option.value.toLowerCase()}_desc`)}
              </option>
            ))}
          </AuthSelect>
        ) : (
          <>
            {/* Public mode: Admin-only registration. Riders use the mobile app or are created by admins. */}
            <div className="rounded-[16px] border border-blue-500/20 bg-blue-500/[0.05] p-3.5 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 mt-0.5">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-xs font-bold text-ink">{t('admin_only_registration_title', 'Fleet Admin Registration')}</p>
                <p className="text-[11px] text-ink-muted leading-relaxed mt-0.5">
                  {t('admin_only_registration_desc', 'This form creates a fleet admin account. Riders can register through the E-Moto mobile app or be added by admins from the dashboard.')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
                {selectedPlanSlug === 'insurance' ? (
                  <>
                    <AuthSelect
                      label={t('insurance_company_label')}
                      value={insurerName}
                      onChange={(event) => setInsurerName(event.target.value)}
                      disabled={isFormDisabled || isGateLocked}
                    >
                      <option value="">{t('select_insurance_placeholder')}</option>
                      {RWANDA_INSURERS.map((ins) => (
                        <option key={ins} value={ins}>
                          {ins}
                        </option>
                      ))}
                      <option value="Other">{t('other')}</option>
                    </AuthSelect>

                    {insurerName === 'Other' && (
                      <AuthInput
                        label={t('insurance_company_name_label')}
                        placeholder={t('insurance_company_name_placeholder', 'e.g. Sanlam Insurance')}
                        value={customInsurerName}
                        onChange={(event) => setCustomInsurerName(event.target.value)}
                        disabled={isFormDisabled || isGateLocked}
                        icon={<Building2 size={16} />}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <AuthInput
                      label={t('fleet_name')}
                      placeholder={t('fleet_name_placeholder', 'e.g. Kigali Express Fleet')}
                      value={fleetName}
                      onChange={(event) => setFleetName(event.target.value)}
                      disabled={isFormDisabled || isGateLocked}
                      icon={<Building2 size={16} />}
                    />

                    {/* Fleet Type Selector */}
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                        {t('fleet_type_label')}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: 'COOP' as const, icon: <UsersRound size={18} />, label: 'Cooperative', rate: '350 RWF/active day' },
                          { value: 'DELIVERY' as const, icon: <Truck size={18} />, label: 'Delivery Fleet', rate: '500 RWF/active day' },
                          { value: 'PERSONAL' as const, icon: <User size={18} />, label: 'Individual', rate: '350 RWF/active day' },
                        ]).map((ft) => {
                          const isSelected = fleetType === ft.value;
                          return (
                            <button
                              key={ft.value}
                              type="button"
                              onClick={() => setFleetType(ft.value)}
                              disabled={isFormDisabled || isGateLocked}
                              className={cx(
                                'group relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-center transition-all duration-200',
                                isSelected
                                  ? 'border-accent bg-accent/10 shadow-sm shadow-accent/15'
                                  : 'border-line bg-surface-muted hover:border-ink-faint hover:bg-surface-hover',
                                (isFormDisabled || isGateLocked) && 'opacity-50 cursor-not-allowed',
                              )}
                            >
                              <span className={cx(
                                'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                                isSelected ? 'bg-accent/20 text-accent' : 'bg-surface text-ink-muted group-hover:text-ink',
                              )}>
                                {ft.icon}
                              </span>
                              <span className={cx(
                                'text-xs font-bold leading-tight',
                                isSelected ? 'text-accent' : 'text-ink',
                              )}>
                                {ft.label}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-400">
                                {ft.rate}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-ink-muted flex items-center gap-2">
                        <ShieldCheck size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
                        <span>{t('hardware_policy_notice', 'Hardware Policy: 0 RWF Device Setup Fee. GPS hardware devices remain company property of eMoto Fleet OS.')}</span>
                      </div>
                    </div>

                    {/* Promo Code Input */}
                    <div className="mt-3 rounded-2xl border border-line bg-surface-muted/30 p-4 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">
                        {t('promo_code_label', 'Have a promo code?')}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t('promo_code_placeholder', 'Enter code...')}
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          disabled={isFormDisabled || isGateLocked}
                          className="h-9 flex-1 bg-surface border border-line rounded-xl px-3 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={handleValidatePromo}
                          disabled={!promoCode || isValidatingPromo || isFormDisabled || isGateLocked}
                          className="px-4 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isValidatingPromo ? t('promo_code_checking', 'Checking...') : t('promo_code_apply', 'Apply')}
                        </button>
                      </div>
                      {appliedDiscount ? (
                        <p className="text-xs text-success-ink font-semibold flex items-center gap-1.5 animate-fade-in">
                          ✓ {t('promo_code_success', 'Discount "{name}" validated successfully!').replace('{name}', appliedDiscount.name)}
                        </p>
                      ) : promoError ? (
                        <p className="text-xs text-danger-ink font-semibold animate-fade-in">
                          {promoError}
                        </p>
                      ) : null}
                    </div>

                    <AuthSelect
                      label={t('bike_range_label')}
                      value={bikeRange}
                      onChange={(event) => setBikeRange(event.target.value)}
                      disabled={isFormDisabled || isGateLocked}
                    >
                      {BIKE_RANGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t('bike_range_' + opt.value.replace('+', '_plus'), opt.label)}
                        </option>
                      ))}
                    </AuthSelect>
                  </>
                )}
              </div>
          </>
        )}

        <AuthCheckbox
          checked={termsAccepted}
          onChange={setTermsAccepted}
          label={`${t('terms_prefix')}${t('terms_link')}${t('terms_and')}${t('privacy_link')}`}
          disabled={isFormDisabled || isGateLocked}
        />
        {mergedErrors.terms ? (
          <p className="text-xs font-medium text-danger-ink">{mergedErrors.terms}</p>
        ) : null}

        <AuthButton
          type="submit"
          label={isSubmitting ? t('signup_button_loading') : t('signup_button')}
          isLoading={isSubmitting}
          disabled={isFormDisabled || isGateLocked}
        />

        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-line" />
          <span>{t('or_continue_with')}</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AuthButton
            type="button"
            variant="secondary"
            label="Google"
            icon={<span className="text-base font-semibold">G</span>}
            onClick={() => handleSocialLogin('google', setSocialNotice, t)}
          />
          <AuthButton
            type="button"
            variant="secondary"
            label="Apple"
            icon={<span className="text-base font-semibold">A</span>}
            onClick={() => handleSocialLogin('apple', setSocialNotice, t)}
          />
        </div>

        <p className="text-center text-xs text-ink-muted">
          {t('have_account')}{' '}
          <Link href="/login" className="font-semibold text-ink">
            {t('login_link')}
          </Link>
        </p>
      </form>

      {isAdminMode ? (
        <div className="mt-6 rounded-[20px] border border-line bg-surface-muted p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {t('invite_codes_title')}
          </p>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            {t('invite_codes_desc')}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AuthSelect
              label={t('invite_role_label')}
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as UserRole)}
              disabled={inviteSubmitting}
            >
              {inviteRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`role_${option.value.toLowerCase()}`)}
                </option>
              ))}
            </AuthSelect>
            <AuthInput
              label={t('expires_in_hours_label')}
              placeholder={t('expires_in_hours_placeholder', '168')}
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
                {t('invite_code_label')}
              </p>
              <p className="mt-2 break-all font-mono text-xs text-ink">
                {inviteTokenValue}
              </p>
              {inviteExpiresAt ? (
                <p className="mt-2 text-xs text-ink-muted">
                  {t('expires_label')} {new Date(inviteExpiresAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <AuthButton
            type="button"
            variant="secondary"
            label={inviteSubmitting ? t('generating_invite_btn') : t('generate_invite_btn')}
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
  t: (key: string, fallback?: string) => string,
) {
  const oauthUrl =
    provider === 'google'
      ? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_URL
      : process.env.NEXT_PUBLIC_APPLE_OAUTH_URL;

  if (!oauthUrl) {
    setNotice(t('social_signup_not_configured', 'Social sign-up is not configured for this environment yet.'));
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

  if (touched.fullName && fullName.trim().length < 2) {
    errors.fullName = 'full_name_error';
  }
  if (touched.email && !email.trim()) {
    errors.email = 'email_error';
  } else if (touched.email && !z.string().email().safeParse(email).success) {
    errors.email = 'email_invalid_error';
  }
  if (touched.phone && phone.trim().length > 0) {
    if (!/^07\d{8}$/.test(phone.trim())) {
      errors.phone = 'phone_error';
    }
  }
  if (touched.password && password.length < 8) {
    errors.password = 'password_error';
  }
  if (touched.confirmPassword && confirmPassword.length > 0 && confirmPassword !== password) {
    errors.confirmPassword = 'passwords_match_error';
  }
  if (touched.terms && !termsAccepted) {
    errors.terms = 'terms_error';
  }
  return errors;
}

