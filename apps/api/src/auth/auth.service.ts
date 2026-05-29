import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { PublicRegisterDto } from './dto/public-register.dto';
import { RedeemInviteDto } from './dto/redeem-invite.dto';
import { RegisterFleetDto } from './dto/register-fleet.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginOtpDto } from './dto/login-otp.dto';

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
      name: true,
      plan: true,
      subscriptionStatus: true,
    },
  },
} satisfies Prisma.UserSelect;

type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof userSelectForAuth;
}>;

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
  async login(dto: LoginDto): Promise<
    | {
        accessToken: string;
        tokenType: 'Bearer';
        user: AuthenticatedUser;
      }
    | {
        requireOtp: true;
        email: string;
        tempToken: string;
        otp?: string;
      }
  > {
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

    if (
      !user ||
      (user.status !== 'ACTIVE' && user.status !== 'PENDING_SETUP')
    ) {
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

    // Enforce OTP login verification for every system user (bypassed in test envs)
    const isTestEnv =
      process.env.NODE_ENV === 'test' || process.env.BYPASS_OTP === 'true';
    if (!isTestEnv) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const userIdentifier = user.email ?? user.phone ?? user.id;
      const otpKey = `email_otp:login:${userIdentifier}`;
      await this.redisService.set(otpKey, otp, 300); // 5 minutes TTL

      const border = '='.repeat(40);
      this.logger.log(`
\x1b[33m${border}\x1b[0m
\x1b[32m  [OTP Verification] for LOGIN\x1b[0m
\x1b[36m  User:  ${userIdentifier}\x1b[0m
\x1b[35m  OTP:   ${otp}\x1b[0m
\x1b[33m${border}\x1b[0m
`);

      const tempToken = `temp_login_session_${randomBytes(24).toString('hex')}`;
      const tempKey = `temp_login_data:${tempToken}`;
      await this.redisService.set(
        tempKey,
        JSON.stringify({
          userId: user.id,
          rememberMe: dto.rememberMe ?? false,
        }),
        300, // 5 minutes TTL
      );

      return {
        requireOtp: true,
        email: userIdentifier,
        tempToken,
        otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      };
    }

    const authenticatedUser = this.toAuthenticatedUser(user);

    this.auditService
      .createAuditLog({
        fleetId: authenticatedUser.fleetId,
        actorUserId: authenticatedUser.id,
        actionType: AuditActionType.LOGIN_SUCCESS,
        targetType: 'User',
        targetId: authenticatedUser.id,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to log login audit: ${error instanceof Error ? error.message : 'unknown'}`,
        );
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

    await this.redisService.set(
      key,
      String(newAttempts),
      LOGIN_LOCKOUT_SECONDS,
    );

    if (fleetId) {
      this.auditService
        .createAuditLog({
          fleetId,
          actorUserId: userId,
          actionType: AuditActionType.LOGIN_FAILED,
          targetType: 'User',
          targetId: userId,
          metaJson: { identifier, attempt: newAttempts },
        })
        .catch(() => {});
    }

    if (newAttempts >= LOGIN_MAX_ATTEMPTS) {
      this.logger.warn(
        `Account locked: ${identifier} after ${newAttempts} failed attempts`,
      );
      if (fleetId) {
        this.auditService
          .createAuditLog({
            fleetId,
            actorUserId: userId,
            actionType: AuditActionType.ACCOUNT_LOCKED,
            targetType: 'User',
            targetId: userId,
            metaJson: { identifier, lockoutSeconds: LOGIN_LOCKOUT_SECONDS },
          })
          .catch(() => {});
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

    if (normalizedEmail) {
      const isVerified = await this.redisService.get(
        `email_verified:${normalizedEmail}`,
      );
      if (isVerified !== 'true') {
        throw new BadRequestException(
          'Please verify your email address using OTP first',
        );
      }
    }

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
          role: canAssignAnyRole
            ? (dto.role ?? UserRole.DISPATCHER)
            : UserRole.RIDER,
          email: normalizedEmail,
          phone: dto.phone,
          passwordHash,
          status: 'ACTIVE',
        },
        select: userSelectForAuth,
      });

      if (normalizedEmail) {
        await this.redisService.del(`email_verified:${normalizedEmail}`);
      }

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

    if (normalizedEmail) {
      const isVerified = await this.redisService.get(
        `email_verified:${normalizedEmail}`,
      );
      if (isVerified !== 'true') {
        throw new BadRequestException(
          'Please verify your email address using OTP first',
        );
      }
    }

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

      if (normalizedEmail) {
        await this.redisService.del(`email_verified:${normalizedEmail}`);
      }

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

    if (normalizedEmail) {
      const isVerified = await this.redisService.get(
        `email_verified:${normalizedEmail}`,
      );
      if (isVerified !== 'true') {
        throw new BadRequestException(
          'Please verify your email address using OTP first',
        );
      }
    }

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
            status: 'ACTIVE',
          },
          select: userSelectForAuth,
        });

        return user as AuthUserRecord;
      });

      this.logger.log(
        `Fleet "${dto.fleetName}" created with admin ${normalizedEmail ?? dto.phone} (bikeRange: ${dto.bikeRange})`,
      );

      if (normalizedEmail) {
        await this.redisService.del(`email_verified:${normalizedEmail}`);
      }

      return this.toAuthenticatedUser(result);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or phone already exists');
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

    const createdInvite = await this.prismaService.registrationInvite.create({
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

    if (normalizedEmail) {
      const isVerified = await this.redisService.get(
        `email_verified:${normalizedEmail}`,
      );
      if (isVerified !== 'true') {
        throw new BadRequestException(
          'Please verify your email address using OTP first',
        );
      }
    }

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

      if (normalizedEmail) {
        await this.redisService.del(`email_verified:${normalizedEmail}`);
      }

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

  // Generates a one-time secure token, stores it in Redis with user.id mapping, and returns success response.
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; token?: string }> {
    const normalizedIdentifier = dto.identifier.trim().toLowerCase();

    // Look up the user by email or phone
    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ email: normalizedIdentifier }, { phone: dto.identifier.trim() }],
      },
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    // Generate secure 6-character alphanumeric reset token
    const token = randomBytes(3).toString('hex').toUpperCase();

    // Cache the user ID with the token mapping in Redis for 1 hour
    await this.redisService.set(`password_reset:${token}`, user.id, 3600);

    return {
      message: 'Reset token generated.',
      token: process.env.NODE_ENV !== 'production' ? token : undefined,
    };
  }

  // Completes the password reset by checking token validity, updating database, and removing it from Redis.
  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const userId = await this.redisService.get(`password_reset:${dto.token}`);
    if (!userId) {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash the new password and update user in database
    const passwordHash = await this.hashPassword(dto.password);
    await this.prismaService.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Delete token from Redis
    await this.redisService.del(`password_reset:${dto.token}`);

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  // Lists all users in the caller's fleet for team management.
  async listFleetUsers(actor: AuthenticatedUser) {
    const users = await this.prismaService.user.findMany({
      where: { fleetId: actor.fleetId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        riderProfile: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return users;
  }

  // Changes a fleet user's role (restricted to same fleet, owner/admin only).
  async changeFleetUserRole(
    actor: AuthenticatedUser,
    userId: string,
    newRole: UserRole,
  ) {
    const targetUser = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, fleetId: true, role: true },
    });

    if (!targetUser || targetUser.fleetId !== actor.fleetId) {
      throw new BadRequestException('User not found in your fleet');
    }

    if (targetUser.id === actor.id) {
      throw new BadRequestException('Cannot change your own role');
    }

    // Only OWNER can assign/remove ADMIN
    if (
      (newRole === UserRole.OWNER || targetUser.role === UserRole.OWNER) &&
      actor.role !== UserRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only fleet owners can assign owner/admin roles',
      );
    }

    const updated = await this.prismaService.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return updated;
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
    if (user.status !== 'ACTIVE' && user.status !== 'PENDING_SETUP') {
      throw new UnauthorizedException('User is not active');
    }

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
    const expiresIn =
      rememberMe && rememberExpiresIn ? rememberExpiresIn : defaultExpiresIn;
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

  // Generates and stores a one-time OTP for email verification.
  async sendOtp(dto: SendOtpDto): Promise<{ message: string; otp?: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    if (dto.reason === 'register') {
      const existingUser = await this.prismaService.user.findFirst({
        where: { email: normalizedEmail },
      });
      if (existingUser) {
        throw new ConflictException('Email is already registered');
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `email_otp:${dto.reason}:${normalizedEmail}`;
    await this.redisService.set(otpKey, otp, 300); // 5 minutes TTL

    const border = '='.repeat(40);
    this.logger.log(`
\x1b[33m${border}\x1b[0m
\x1b[32m  [OTP Verification] for ${dto.reason.toUpperCase()}\x1b[0m
\x1b[36m  Email: ${normalizedEmail}\x1b[0m
\x1b[35m  OTP:   ${otp}\x1b[0m
\x1b[33m${border}\x1b[0m
`);

    return {
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  // Verifies email OTP during registration.
  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const otpKey = `email_otp:${dto.reason}:${normalizedEmail}`;
    const cachedOtp = await this.redisService.get(otpKey);

    if (!cachedOtp || cachedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (dto.reason === 'register') {
      await this.redisService.set(
        `email_verified:${normalizedEmail}`,
        'true',
        900,
      ); // 15 minutes TTL
    }

    await this.redisService.del(otpKey);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  // Verifies the login OTP using the temporary session token.
  async loginWithOtp(dto: LoginOtpDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
    rememberMe: boolean;
  }> {
    const tempKey = `temp_login_data:${dto.tempToken}`;
    const rawData = await this.redisService.get(tempKey);
    if (!rawData) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const { userId, rememberMe } = JSON.parse(rawData) as {
      userId: string;
      rememberMe: boolean;
    };

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: userSelectForAuth,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userIdentifier = user.email ?? user.phone ?? user.id;
    const otpKey = `email_otp:login:${userIdentifier}`;
    const cachedOtp = await this.redisService.get(otpKey);
    if (!cachedOtp || cachedOtp !== dto.otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.redisService.del(tempKey);
    await this.redisService.del(otpKey);

    const authenticatedUser = this.toAuthenticatedUser(user);

    this.auditService
      .createAuditLog({
        fleetId: authenticatedUser.fleetId,
        actorUserId: authenticatedUser.id,
        actionType: AuditActionType.LOGIN_SUCCESS,
        targetType: 'User',
        targetId: authenticatedUser.id,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to log login audit: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      });

    const authResponse = await this.buildAuthResponse(
      authenticatedUser,
      rememberMe,
    );

    return {
      accessToken: authResponse.accessToken,
      tokenType: 'Bearer',
      user: authenticatedUser,
      rememberMe,
    };
  }

  // Maps user records into the authenticated user payload used by the API and dashboard.
  private toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      fleetId: user.fleetId,
      fleetName: user.fleet.name,
      fleetPlan: user.fleet.plan,
      subscriptionStatus: user.fleet.subscriptionStatus,
      role: user.role,
      email: user.email,
      phone: user.phone,
      status: user.status,
    };
  }
}
