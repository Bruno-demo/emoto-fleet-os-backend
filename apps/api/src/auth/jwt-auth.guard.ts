import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Resolves and validates bearer tokens and attaches the authenticated user to the request.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : undefined;
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'emoto_access_token',
    );
    const cookieToken = request.cookies?.[cookieName];
    const resolvedToken = token ?? cookieToken;

    if (!resolvedToken) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user =
      await this.authService.authenticateAccessToken(resolvedToken);
    return true;
  }
}
