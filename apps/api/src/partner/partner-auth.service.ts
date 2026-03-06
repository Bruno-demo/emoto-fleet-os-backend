import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PartnerClientStatus, PartnerStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { partnerTokenRequestSchema } from './partner-auth.schema';
import type {
  AuthenticatedPartner,
  PartnerJwtPayload,
  PartnerTokenResponse,
} from './partner.types';

@Injectable()
export class PartnerAuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  // Validates client credentials and issues partner-scoped bearer tokens.
  async issueTokenFromClientCredentials(
    payload: unknown,
  ): Promise<PartnerTokenResponse> {
    const parsedPayload = partnerTokenRequestSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new BadRequestException('Invalid partner token request payload');
    }

    const partnerClient = await this.prismaService.partnerClient.findUnique({
      where: {
        clientId: parsedPayload.data.clientId,
      },
      include: {
        partner: {
          include: {
            fleetAccesses: {
              where: { active: true },
              select: { fleetId: true },
            },
          },
        },
      },
    });

    if (!partnerClient || partnerClient.status !== PartnerClientStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid partner credentials');
    }
    if (partnerClient.partner.status !== PartnerStatus.ACTIVE) {
      throw new UnauthorizedException('Partner is disabled');
    }

    const secretMatches = await bcrypt.compare(
      parsedPayload.data.clientSecret,
      partnerClient.clientSecretHash,
    );
    if (!secretMatches) {
      throw new UnauthorizedException('Invalid partner credentials');
    }

    const scopes = this.parseScopes(partnerClient.scopes);
    const expiresIn = this.configService.getOrThrow<string>(
      'PARTNER_JWT_EXPIRES_IN',
    ) as StringValue;
    const tokenPayload: PartnerJwtPayload = {
      sub: partnerClient.id,
      partnerId: partnerClient.partnerId,
      clientId: partnerClient.clientId,
      scopes,
      tokenType: 'partner',
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      expiresIn,
    });

    await Promise.all(
      partnerClient.partner.fleetAccesses.map((fleetAccess) =>
        this.auditService.createAuditLog({
          fleetId: fleetAccess.fleetId,
          actionType: 'PARTNER_TOKEN_ISSUED',
          targetType: 'PartnerClient',
          targetId: partnerClient.id,
          metaJson: {
            partnerId: partnerClient.partnerId,
            partnerClientId: partnerClient.id,
            scopes,
          },
        }),
      ),
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      scopes,
    };
  }

  // Verifies partner access tokens and resolves active partner identity context.
  async authenticateAccessToken(token: string): Promise<AuthenticatedPartner> {
    let jwtPayload: PartnerJwtPayload;
    try {
      jwtPayload = await this.jwtService.verifyAsync<PartnerJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid partner token');
    }

    if (jwtPayload.tokenType !== 'partner') {
      throw new UnauthorizedException('Unsupported token type');
    }

    const partnerClient = await this.prismaService.partnerClient.findUnique({
      where: { id: jwtPayload.sub },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!partnerClient || partnerClient.status !== PartnerClientStatus.ACTIVE) {
      throw new UnauthorizedException('Partner client is not active');
    }
    if (partnerClient.partner.status !== PartnerStatus.ACTIVE) {
      throw new UnauthorizedException('Partner is disabled');
    }
    if (partnerClient.partnerId !== jwtPayload.partnerId) {
      throw new UnauthorizedException('Partner token validation failed');
    }

    const activeScopes = this.parseScopes(partnerClient.scopes);
    const tokenScopes = new Set(jwtPayload.scopes);
    const effectiveScopes = activeScopes.filter((scope) =>
      tokenScopes.has(scope),
    );

    return {
      partnerId: partnerClient.partner.id,
      partnerName: partnerClient.partner.name,
      partnerStatus: partnerClient.partner.status,
      partnerClientId: partnerClient.clientId,
      scopes: effectiveScopes,
    };
  }

  // Normalizes scope strings into stable, deduplicated string arrays.
  private parseScopes(scopeString: string): string[] {
    const scopeSet = new Set(
      scopeString
        .split(/\s+/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );

    return Array.from(scopeSet.values()).sort((left, right) =>
      left.localeCompare(right),
    );
  }
}
