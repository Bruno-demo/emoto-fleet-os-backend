import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { PartnerAuthenticatedRequest } from './partner.types';
import { PartnerAuthService } from './partner-auth.service';

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  constructor(private readonly partnerAuthService: PartnerAuthService) {}

  // Validates partner bearer tokens and stores partner identity on request context.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<PartnerAuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing partner bearer token');
    }

    request.partner =
      await this.partnerAuthService.authenticateAccessToken(token);
    return true;
  }
}
