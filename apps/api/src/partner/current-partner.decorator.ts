import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PartnerAuthenticatedRequest } from './partner.types';

// Extracts authenticated partner identity from request context.
export const CurrentPartner = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<PartnerAuthenticatedRequest>();
    return request.partner;
  },
);
