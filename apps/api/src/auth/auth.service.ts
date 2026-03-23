import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from './auth.types';
import { CreateInviteDto } from './dto/create-invite.dto';
import { LoginDto } from './dto/login.dto';
import { PublicRegisterDto } from './dto/public-register.dto';
import { RedeemInviteDto } from './dto/redeem-invite.dto';
import { RegisterDto } from './dto/register.dto';

const userSelectForAuth = {
  id: true,
  fleetId: true,
  role: true,
  email: true,
  phone: true,
  passwordHash: true,
  status: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Authenticates with email/password or phone/password and returns an access token.
  async login(dto: LoginDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);

    const whereClauses: Prisma.UserWhereInput[] = [];
    if (normalizedEmail) {
      whereClauses.push({ email: normalizedEmail });
    }
    if (dto.phone) {
      whereClauses.push({ phone: dto.phone });
    }

    const user = await this.prismaService.user.findFirst({
      where: {
        OR: whereClauses,
      },
      select: userSelectForAuth,
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  // Registers a new user inside the caller's fleet when self-registration is enabled.
  async register(
    actor: AuthenticatedUser,
    dto: RegisterDto,
  ): Promise<AuthenticatedUser> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      false,
    );
    if (!registerEnabled) {
      throw new ForbiddenException('Registration is disabled');
    }

    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);

    const canAssignAnyRole =
      actor.role === UserRole.OWNER || actor.role === UserRole.ADMIN;
    if (!canAssignAnyRole && dto.role && dto.role !== UserRole.RIDER) {
      throw new ForbiddenException(
        'Only rider accounts can be created by non-admin roles',
      );
    }

    const passwordHash = await this.hashPassword(dto.password);
    try {
      const createdUser = await this.prismaService.user.create({
        data: {
          fleetId: actor.fleetId,
          role: canAssignAnyRole ? dto.role ?? UserRole.DISPATCHER : UserRole.RIDER,
          email: normalizedEmail,
          phone: dto.phone,
          passwordHash,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          fleetId: true,
          role: true,
          email: true,
          phone: true,
          status: true,
        },
      });

      return createdUser;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email or phone already exists in this fleet',
        );
      }

      throw error;
    }
  }

  // Registers a rider account for a fleet using a public sign-up flow.
  async registerPublic(dto: PublicRegisterDto): Promise<AuthenticatedUser> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      false,
    );
    if (!registerEnabled) {
      throw new ForbiddenException('Registration is disabled');
    }
    const publicRegisterEnabled = this.configService.get<boolean>(
      'AUTH_PUBLIC_REGISTER_ENABLED',
      false,
    );
    if (!publicRegisterEnabled) {
      throw new ForbiddenException('Public registration is disabled');
    }

    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);

    const fleet = await this.prismaService.fleet.findUnique({
      where: { id: dto.fleetId },
      select: { id: true },
    });
    if (!fleet) {
      throw new BadRequestException('Fleet not found');
    }

    const passwordHash = await this.hashPassword(dto.password);
    try {
      const createdUser = await this.prismaService.user.create({
        data: {
          fleetId: dto.fleetId,
          role: UserRole.RIDER,
          email: normalizedEmail,
          phone: dto.phone,
          passwordHash,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          fleetId: true,
          role: true,
          email: true,
          phone: true,
          status: true,
        },
      });

      return createdUser;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email or phone already exists in this fleet',
        );
      }

      throw error;
    }
  }

  // Creates a one-time registration invite for the caller's fleet.
  async createInvite(
    actor: AuthenticatedUser,
    dto: CreateInviteDto,
  ): Promise<{
    inviteId: string;
    token: string;
    fleetId: string;
    role: UserRole;
    email: string | null;
    phone: string | null;
    expiresAt: Date;
  }> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      false,
    );
    if (!registerEnabled) {
      throw new ForbiddenException('Registration is disabled');
    }

    const role = dto.role ?? UserRole.RIDER;
    if (role === UserRole.OWNER || role === UserRole.INSURER) {
      throw new ForbiddenException('Invite role is not allowed');
    }
    if (role === UserRole.ADMIN && actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only owners can invite admins');
    }

    const token = this.generateInviteToken();
    const tokenHash = this.hashInviteToken(token);
    const normalizedEmail = dto.email?.toLowerCase();
    const expiresInHours =
      dto.expiresInHours ??
      this.configService.get<number>('INVITE_TOKEN_TTL_HOURS', 168);
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const createdInvite =
      await this.prismaService.registrationInvite.create({
        data: {
          fleetId: actor.fleetId,
          role,
          email: normalizedEmail,
          phone: dto.phone,
          tokenHash,
          expiresAt,
        },
        select: {
          id: true,
          fleetId: true,
          role: true,
          email: true,
          phone: true,
          expiresAt: true,
        },
      });

    return {
      inviteId: createdInvite.id,
      token,
      fleetId: createdInvite.fleetId,
      role: createdInvite.role,
      email: createdInvite.email,
      phone: createdInvite.phone,
      expiresAt: createdInvite.expiresAt,
    };
  }

  // Redeems an invite token and creates the corresponding fleet user.
  async redeemInvite(dto: RedeemInviteDto): Promise<AuthenticatedUser> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      false,
    );
    if (!registerEnabled) {
      throw new ForbiddenException('Registration is disabled');
    }

    const tokenHash = this.hashInviteToken(dto.token);
    const invite = await this.prismaService.registrationInvite.findUnique({
      where: { tokenHash },
    });

    if (!invite || invite.status !== 'ACTIVE') {
      throw new ForbiddenException('Invite is invalid or already used');
    }

    const now = new Date();
    if (invite.expiresAt <= now) {
      await this.prismaService.registrationInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      throw new ForbiddenException('Invite has expired');
    }

    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);

    if (invite.email && !normalizedEmail) {
      throw new ForbiddenException('Email required for this invite');
    }
    if (invite.email && invite.email !== normalizedEmail) {
      throw new ForbiddenException('Email does not match invite');
    }
    if (invite.phone && !dto.phone) {
      throw new ForbiddenException('Phone required for this invite');
    }
    if (invite.phone && invite.phone !== dto.phone) {
      throw new ForbiddenException('Phone does not match invite');
    }

    const passwordHash = await this.hashPassword(dto.password);

    try {
      const createdUser = await this.prismaService.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fleetId: invite.fleetId,
            role: invite.role,
            email: normalizedEmail ?? invite.email,
            phone: dto.phone ?? invite.phone,
            passwordHash,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            fleetId: true,
            role: true,
            email: true,
            phone: true,
            status: true,
          },
        });

        await tx.registrationInvite.update({
          where: { id: invite.id },
          data: {
            status: 'USED',
            usedAt: now,
            usedByUserId: user.id,
          },
        });

        return user;
      });

      return createdUser;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email or phone already exists in this fleet',
        );
      }

      throw error;
    }
  }

  // Returns the current authenticated user profile.
  async me(userId: string): Promise<AuthenticatedUser> {
    return this.loadUserOrThrow(userId);
  }

  // Verifies an access token and returns the active user identity.
  async authenticateAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.loadUserOrThrow(payload.sub);
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    return user;
  }

  // Signs and returns a JWT access token and public user payload.
  private async buildAuthResponse(
    user: Prisma.UserGetPayload<{ select: typeof userSelectForAuth }>,
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      fleetId: user.fleetId,
      role: user.role,
    };

    const expiresIn = this.configService.getOrThrow<string>(
      'JWT_EXPIRES_IN',
    ) as StringValue;
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        fleetId: user.fleetId,
        role: user.role,
        email: user.email,
        phone: user.phone,
        status: user.status,
      },
    };
  }

  // Hashes user passwords with bcrypt using configured work factor.
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10);
    return await bcrypt.hash(password, saltRounds);
  }

  // Creates a random invite token safe for sharing out of band.
  private generateInviteToken(): string {
    return `invite_${randomBytes(24).toString('base64url')}`;
  }

  // Hashes invite tokens before storing them in the database.
  private hashInviteToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Validates that at least one login identifier is supplied.
  private assertIdentifierProvided(email?: string, phone?: string): void {
    if (!email && !phone) {
      throw new BadRequestException('Provide either email or phone');
    }
  }

  // Loads a user identity projection or throws unauthorized when missing.
  private async loadUserOrThrow(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fleetId: true,
        role: true,
        email: true,
        phone: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
