import { z } from 'zod';

const fleetIdSchema = z.string().min(1);

export const userRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'DISPATCHER',
  'TECH',
  'INSURER',
  'RIDER',
]);

export const userStatusSchema = z.enum(['INVITED', 'PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'DISABLED']);
export const fleetPlanSchema = z.enum(['DEMO', 'PREMIUM']);
export const subscriptionStatusSchema = z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED']);

export const authUserSchema = z.object({
  id: z.string().uuid(),
  fleetId: fleetIdSchema,
  fleetName: z.string().nullable().optional(),
  fleetPlan: fleetPlanSchema.optional(),
  subscriptionStatus: subscriptionStatusSchema.optional(),
  role: userRoleSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: userStatusSchema,
});

export const loginFormSchema = z.object({
  identifier: z.string().min(3, 'Provide email or phone'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginResponseSchema = z.union([
  z.object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    user: authUserSchema,
  }),
  z.object({
    requireOtp: z.literal(true),
    email: z.string(),
    tempToken: z.string().min(1),
    otp: z.string().optional(),
  }),
]);

export const meResponseSchema = authUserSchema;

export const subscriptionCheckoutResponseSchema = z.object({
  fleetPlan: fleetPlanSchema,
  subscriptionStatus: subscriptionStatusSchema,
});

// Builds the backend login payload by mapping identifier to email or phone.
export function buildLoginPayload(
  identifier: string,
  password: string,
  rememberMe: boolean,
) {
  const normalizedIdentifier = identifier.trim();
  const commonFields = rememberMe ? { password, rememberMe } : { password };

  if (normalizedIdentifier.includes('@')) {
    return {
      ...commonFields,
      email: normalizedIdentifier.toLowerCase(),
    };
  }

  return {
    ...commonFields,
    phone: normalizedIdentifier,
  };
}
