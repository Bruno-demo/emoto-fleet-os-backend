import { z } from 'zod';

export const partnerTokenRequestSchema = z.object({
  clientId: z.string().min(3).max(128),
  clientSecret: z.string().min(8).max(256),
});

export type PartnerTokenRequest = z.infer<typeof partnerTokenRequestSchema>;
