import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class HqGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      return false; // Let JwtAuthGuard handle unauthenticated
    }

    if (user.fleetName !== 'E-Moto HQ') {
      throw new ForbiddenException('Access restricted to E-Moto HQ staff only.');
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Admin role required for HQ access.');
    }

    return true;
  }
}
