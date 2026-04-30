import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditActionType, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthenticatedUser, JwtPayload } from './auth.types';
import { CreateInviteDto } from './dto/create-invite.dto';
import { LoginDto } from './dto/login.dto';
import { PublicRegisterDto } from './dto/public-register.dto';
import { RedeemInviteDto } from './dto/redeem-invite.dto';
import { RegisterFleetDto } from './dto/register-fleet.dto';
import { RegisterDto } from './dto/register.dto';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 900; // 15 minutes

const userSelectForAuth = {
  id: true,
  fleetId: true,
  role: true,
  email: true,
  phone: true,
  passwordHash: true,
  status: true,
  fleet: {
    select: {
      plan: true,
      subscriptionStatus: true,
    },
  },
} satisfies Prisma.UserSelect;

type AuthUserRecord = Prisma.UserGetPayload<{ select: typeof userSelectForAuth }>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  // Authenticates with email/password or phone/password and returns an access token.
  async login(dto: LoginDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);

    const identifier = normalizedEmail ?? dto.phone ?? 'unknown';
    await this.assertNotLockedOut(identifier);

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
      await this.recordFailedLogin(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      await this.recordFailedLogin(identifier, user.id, user.fleetId);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearFailedAttempts(identifier);

    const authenticatedUser = this.toAuthenticatedUser(user);
    this.assertDashboardAccess(authenticatedUser);

    this.auditService.createAuditLog({
      fleetId: authenticatedUser.fleetId,
      actorUserId: authenticatedUser.id,
      actionType: AuditActionType.LOGIN_SUCCESS,
      targetType: 'User',
      targetId: authenticatedUser.id,
    }).catch((error: unknown) => {
      this.logger.warn(`Failed to log login audit: ${error instanceof Error ? error.message : 'unknown'}`);
    });

    return this.buildAuthResponse(authenticatedUser, dto.rememberMe ?? false);
  }

  // Checks Redis for too many failed attempts and blocks login if locked out.
  private async assertNotLockedOut(identifier: string): Promise<void> {
    const key = `login_attempts:${identifier}`;
    const raw = await this.redisService.get(key);
    if (!raw) return;

    const attempts = Number(raw);
    if (attempts >= LOGIN_MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
      );
    }
  }

  // Records a failed login attempt in Redis with TTL-based auto-expiry.
  private async recordFailedLogin(
    identifier: string,
    userId?: string,
    fleetId?: string,
  ): Promise<void> {
    const key = `login_attempts:${identifier}`;
    const raw = await this.redisService.get(key);
    const currentAttempts = raw ? Number(raw) : 0;
    const newAttempts = currentAttempts + 1;

    await this.redisService.set(key, String(newAttempts), LOGIN_LOCKOUT_SECONDS);

    if (fleetId) {
      this.auditService.createAuditLog({
        fleetId,
        actorUserId: userId,
        actionType: AuditActionType.LOGIN_FAILED,
        targetType: 'User',
        targetId: userId,
        metaJson: { identifier, attempt: newAttempts },
      }).catch(() => {});
    }

    if (newAttempts >= LOGIN_MAX_ATTEMPTS) {
      this.logger.warn(`Account locked: ${identifier} after ${newAttempts} failed attempts`);
      if (fleetId) {
        this.auditService.createAuditLog({
          fleetId,
          actorUserId: userId,
          actionType: AuditActionType.ACCOUNT_LOCKED,
          targetType: 'User',
          targetId: userId,
          metaJson: { identifier, lockoutSeconds: LOGIN_LOCKOUT_SECONDS },
        }).catch(() => {});
      }
    }
  }

  // Clears failed login attempts after a successful login.
  private async clearFailedAttempts(identifier: string): Promise<void> {
    const key = `login_attempts:${identifier}`;
    await this.redisService.del(key);
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
        select: userSelectForAuth,
      });

      return this.toAuthenticatedUser(createdUser);
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
        select: userSelectForAuth,
      });

      return this.toAuthenticatedUser(createdUser);
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

  // Creates a new fleet and registers the caller as its ADMIN owner.
  async registerFleet(dto: RegisterFleetDto): Promise<AuthenticatedUser> {
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

    const passwordHash = await this.hashPassword(dto.password);

    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        const fleet = await tx.fleet.create({
          data: {
            name: dto.fleetName,
            type: 'DELIVERY',
            plan: dto.plan ?? 'DEMO',
            subscriptionStatus: 'ACTIVE',
          },
        });

        const user = await tx.user.create({
          data: {
            fleetId: fleet.id,
            role: UserRole.ADMIN,
            email: normalizedEmail,
            phone: dto.phone,
            passwordHash,
            status: dto.plan === 'DEMO' ? 'ACTIVE' : 'PENDING_SETUP',
          },
          select: userSelectForAuth,
        });

        return user;
      });

      this.logger.log(
        `Fleet "${dto.fleetName}" created with admin ${normalizedEmail ?? dto.phone} (bikeRange: ${dto.bikeRange})`,
      );

      return this.toAuthenticatedUser(result);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email or phone already exists',
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
          select: userSelectForAuth,
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

      return this.toAuthenticatedUser(createdUser);
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
    this.assertDashboardAccess(user);

    return user;
  }

  // Signs and returns a JWT access token and public user payload.
  private async buildAuthResponse(
    user: AuthenticatedUser,
    rememberMe: boolean,
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

    const defaultExpiresIn = this.configService.getOrThrow<string>(
      'JWT_EXPIRES_IN',
    ) as StringValue;
    const rememberExpiresIn = this.configService.get<string>(
      'AUTH_REMEMBER_ME_EXPIRES_IN',
    ) as StringValue | undefined;
    const expiresIn = rememberMe && rememberExpiresIn ? rememberExpiresIn : defaultExpiresIn;
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn });
    return {
      accessToken,
      tokenType: 'Bearer',
      user,
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
      select: userSelectForAuth,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toAuthenticatedUser(user);
  }

  // Maps user records into the authenticated user payload used by the API and dashboard.
  private toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      fleetId: user.fleetId,
      fleetPlan: user.fleet.plan,
      subscriptionStatus: user.fleet.subscriptionStatus,
      role: user.role,
      email: user.email,
      phone: user.phone,
      status: user.status,
    };
  }

  // Blocks non-rider access unless the fleet is in demo mode or an active premium subscription.
  private assertDashboardAccess(user: AuthenticatedUser): void {
    if (user.role === UserRole.RIDER) {
      return;
    }
    if (user.fleetPlan === 'DEMO') {
      return;
    }
    if (user.fleetPlan === 'PREMIUM' && user.subscriptionStatus === 'ACTIVE') {
      return;
    }

    throw new ForbiddenException('Subscription required');
  }
}
