import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuditActionType, Prisma, UserRole, UserStatus } from '@prisma/client';
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
import { RegisterSelfDto } from './dto/register-self.dto';
import { ContactInquiryDto } from './dto/contact-inquiry.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { MailService } from '../mail/mail.service';

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
  notifOpenIncidents: true,
  notifSosAlerts: true,
  notifCrashEvents: true,
  fleet: {
    select: {
      name: true,
      type: true,
      plan: true,
      subscriptionStatus: true,
      upgradeRequested: true,
      insurerName: true,
      monthlyRatePerBike: true,
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
    private readonly mailService: MailService,
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
      if (dto.phone.startsWith('+250')) {
        whereClauses.push({ phone: dto.phone.replace(/^\+250/, '0') });
      } else if (dto.phone.startsWith('07')) {
        whereClauses.push({ phone: '+250' + dto.phone.slice(1) });
      }
    }

    const user = await this.executeAuthUserQuery(() =>
      this.prismaService.user.findFirst({
        where: {
          OR: whereClauses,
        },
        select: userSelectForAuth,
      }),
    );

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

    // Enforce OTP login verification for every system user (bypassed in test envs and rider accounts)
    const isTestEnv =
      process.env.NODE_ENV === 'test' ||
      process.env.BYPASS_OTP === 'true' ||
      user.role === UserRole.RIDER;
    if (!isTestEnv) {
      try {
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

        if (user.email) {
          this.mailService
            .sendOtpEmail(user.email, otp, 'login')
            .catch((error: unknown) => {
              this.logger.error(
                `Failed to send login OTP email to ${user.email}: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              );
            });
        }

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
      } catch (error: unknown) {
        this.logger.warn(
          `OTP generation failed or Redis offline, proceeding with direct auth: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
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
    try {
      const key = `login_attempts:${identifier}`;
      const raw = await this.redisService.get(key);
      if (!raw) return;

      const attempts = Number(raw);
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        throw new UnauthorizedException(
          'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
        );
      }
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(
        `Failed to query login lockout state in Redis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  // Records a failed login attempt in Redis with TTL-based auto-expiry.
  private async recordFailedLogin(
    identifier: string,
    userId?: string,
    fleetId?: string,
  ): Promise<void> {
    try {
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
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to record failed login in Redis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  // Clears failed login attempts after a successful login.
  private async clearFailedAttempts(identifier: string): Promise<void> {
    try {
      const key = `login_attempts:${identifier}`;
      await this.redisService.del(key);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to clear login attempts in Redis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  // Registers a new user inside the caller's fleet when self-registration is enabled.
  async register(
    actor: AuthenticatedUser,
    dto: RegisterDto,
  ): Promise<AuthenticatedUser> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      true,
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

    const role = dto.role ?? UserRole.DISPATCHER;
    const isHqStaff = actor.fleetName === 'E-Moto HQ';
    if (!isHqStaff && (role === UserRole.OWNER || role === UserRole.INSURER)) {
      throw new ForbiddenException(
        'Only E-Moto HQ superAdmin can register owner or insurer roles',
      );
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
      const createdUser = await this.prismaService.$transaction(
        async (tx) => {
          const user = await tx.user.create({
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

          if (dto.fullName) {
            await tx.riderProfile.create({
              data: {
                userId: user.id,
                fullName: dto.fullName,
              },
            });
          }

          return user;
        },
        { timeout: 30000 },
      );

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
      true,
    );
    if (!registerEnabled) {
      throw new ForbiddenException('Registration is disabled');
    }
    const publicRegisterEnabled = this.configService.get<boolean>(
      'AUTH_PUBLIC_REGISTER_ENABLED',
      true,
    );
    if (!publicRegisterEnabled) {
      throw new ForbiddenException('Public registration is disabled');
    }

    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);
    await this.assertIdentifierUnique(normalizedEmail, dto.phone);

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

  // Registers a self-bike owner (self driver) creating a personal fleet and rider account.
  async registerSelfDriver(dto: RegisterSelfDto): Promise<AuthenticatedUser> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      true,
    );
    if (!registerEnabled) {
      throw new ForbiddenException('Registration is disabled');
    }

    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);
    await this.assertIdentifierUnique(normalizedEmail, dto.phone);

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
      const createdUser = await this.prismaService.$transaction(
        async (tx) => {
          // Create the personal fleet for the self owner
          const plan = dto.plan ?? 'PAYG';
          const monthlyRatePerBike = 10000; // Personal / Individual fleet rate

          const fleet = await tx.fleet.create({
            data: {
              name: `${dto.fullName}'s Bike`,
              type: 'PERSONAL',
              plan,
              subscriptionStatus: 'ACTIVE',
              monthlyRatePerBike,
              billingStartedAt: new Date(),
            },
          });

          // Automatically generate the first billing cycle based on date of registration
          const config = await tx.billingConfig.findFirst();
          const cycleDays = config?.billingCycleDays ?? 30;
          const periodStart = new Date();
          const periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + cycleDays);
          const dueDate = new Date(periodStart);

          await tx.billingCycle.create({
            data: {
              fleetId: fleet.id,
              cycleNumber: 1,
              periodStart,
              periodEnd,
              dueDate,
              bikeCount: 0,
              ratePerBike: monthlyRatePerBike,
              subtotal: 0,
              totalDue: 0,
              totalPaid: 0,
              status: 'PENDING',
              isTrial: false,
            },
          });

          // Create the rider user
          const user = await tx.user.create({
            data: {
              fleetId: fleet.id,
              role: UserRole.RIDER,
              email: normalizedEmail,
              phone: dto.phone,
              passwordHash,
              status: 'PENDING_SETUP',
            },
            select: userSelectForAuth,
          });

          // Create the rider profile
          await tx.riderProfile.create({
            data: {
              userId: user.id,
              fullName: dto.fullName,
            },
          });

          return user;
        },
        { timeout: 30000 },
      );

      if (normalizedEmail) {
        await this.redisService.del(`email_verified:${normalizedEmail}`);
      }

      return this.toAuthenticatedUser(createdUser);
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

  // Creates a new fleet and registers the caller as its ADMIN owner.
  async registerFleet(dto: RegisterFleetDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      true,
    );
    if (!registerEnabled) {
      throw new ForbiddenException('Registration is disabled');
    }
    const publicRegisterEnabled = this.configService.get<boolean>(
      'AUTH_PUBLIC_REGISTER_ENABLED',
      true,
    );
    if (!publicRegisterEnabled) {
      throw new ForbiddenException('Public registration is disabled');
    }

    const normalizedEmail = dto.email?.toLowerCase();
    this.assertIdentifierProvided(normalizedEmail, dto.phone);
    await this.assertIdentifierUnique(normalizedEmail, dto.phone);

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
      const result = await this.prismaService.$transaction(
        async (tx) => {
          const requestedType = dto.fleetType ?? 'COOP';
          const isInsurance = dto.plan === 'INSURANCE';
          const syncedPlan = dto.plan ?? 'PAYG';
          const syncedType = requestedType;
          const dailyRate = syncedType === 'DELIVERY' ? 500 : 350;
          const monthlyRatePerBike = dailyRate * 30;

          let fleetDiscountConnect = undefined;

          if (dto.promoCode) {
            const discount = await tx.discount.findUnique({
              where: { code: dto.promoCode.toUpperCase() },
            });
            if (discount && discount.isActive && !discount.fleetId) {
              const now = new Date();
              const isValidDates =
                (!discount.validFrom || discount.validFrom <= now) &&
                (!discount.validUntil || discount.validUntil >= now);
              if (
                isValidDates &&
                (discount.maxUses === null ||
                  discount.usedCount < discount.maxUses)
              ) {
                fleetDiscountConnect = { id: discount.id };
                await tx.discount.update({
                  where: { id: discount.id },
                  data: { usedCount: { increment: 1 } },
                });
              }
            }
          }

          const fleet = await tx.fleet.create({
            data: {
              name: dto.fleetName,
              type: syncedType,
              plan: syncedPlan,
              insurerName: isInsurance ? dto.insurerName : null,
              subscriptionStatus: 'ACTIVE',
              monthlyRatePerBike,
              emotoPaygRatePerActiveDay: dailyRate,
              billingStartedAt: new Date(),
              bikeRange: dto.bikeRange ? String(dto.bikeRange) : null,
              fleetDiscounts: fleetDiscountConnect
                ? { connect: [fleetDiscountConnect] }
                : undefined,
            },
          });

          // Automatically generate the first billing cycle based on date of registration
          const config = await tx.billingConfig.findFirst();
          const cycleDays = config?.billingCycleDays ?? 30;
          const periodStart = new Date();
          const periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + cycleDays);
          const dueDate = new Date(periodStart);

          await tx.billingCycle.create({
            data: {
              fleetId: fleet.id,
              cycleNumber: 1,
              periodStart,
              periodEnd,
              dueDate,
              bikeCount: 0,
              ratePerBike: monthlyRatePerBike,
              subtotal: 0,
              totalDue: 0,
              totalPaid: 0,
              status: 'PENDING',
              isTrial: false,
            },
          });

          const user = await tx.user.create({
            data: {
              fleetId: fleet.id,
              role:
                dto.plan === 'INSURANCE' ? UserRole.INSURER : UserRole.ADMIN,
              email: normalizedEmail,
              phone: dto.phone,
              passwordHash,
              status: 'PENDING_SETUP',
            },
            select: userSelectForAuth,
          });

          if (dto.fullName) {
            await tx.riderProfile.create({
              data: {
                userId: user.id,
                fullName: dto.fullName,
              },
            });
          }

          if (dto.plan === 'INSURANCE') {
            // Synchronize creation with a matching Partner record using the same UUID
            await tx.partner.create({
              data: {
                id: user.id,
                name: dto.insurerName ?? dto.fleetName,
                status: 'ACTIVE',
              },
            });

            // Grant fleet access to their own fleet
            await tx.partnerFleetAccess.create({
              data: {
                partnerId: user.id,
                fleetId: fleet.id,
                active: true,
              },
            });

            // Provision a default API client credential
            const clientId = `client_${user.id.slice(0, 8)}`;
            const clientSecret = randomBytes(16).toString('hex');
            const clientSecretHash = await bcrypt.hash(clientSecret, 10);

            await tx.partnerClient.create({
              data: {
                partnerId: user.id,
                clientId,
                clientSecretHash,
                scopes: 'insurer:read webhooks:write',
                status: 'ACTIVE',
              },
            });
          }

          return user;
        },
        { timeout: 30000 },
      );

      this.logger.log(
        `Fleet "${dto.fleetName}" created with admin ${normalizedEmail ?? dto.phone} (bikeRange: ${dto.bikeRange})`,
      );

      if (normalizedEmail) {
        await this.redisService.del(`email_verified:${normalizedEmail}`);
      }

      const authenticatedUser = this.toAuthenticatedUser(result);
      return this.buildAuthResponse(authenticatedUser, false);
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
    maxUses: number;
    usedCount: number;
    expiresAt: Date;
  }> {
    if (!actor?.fleetId) {
      throw new BadRequestException(
        'Caller must belong to a fleet to create invites',
      );
    }

    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      true,
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
    const normalizedEmail = dto.email?.trim()
      ? dto.email.trim().toLowerCase()
      : null;
    const phone = dto.phone?.trim() ? dto.phone.trim() : null;

    const rawExpiry = Number(dto.expiresInHours);
    const expiresInHours =
      !isNaN(rawExpiry) && rawExpiry > 0 && rawExpiry <= 720 ? rawExpiry : 168;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const rawMaxUses = Number(dto.maxUses);
    const maxUsesVal = !isNaN(rawMaxUses) && rawMaxUses > 0 ? rawMaxUses : 1;

    let createdInvite: any;
    try {
      createdInvite = await this.prismaService.registrationInvite.create({
        data: {
          fleetId: actor.fleetId,
          role,
          email: normalizedEmail,
          phone,
          tokenHash,
          maxUses: maxUsesVal,
          expiresAt,
        },
        select: {
          id: true,
          fleetId: true,
          role: true,
          email: true,
          phone: true,
          maxUses: true,
          usedCount: true,
          expiresAt: true,
        },
      });
    } catch (dbError: any) {
      this.logger.warn(
        `Primary registrationInvite.create failed, trying legacy fallback: ${dbError?.message}`,
      );
      try {
        createdInvite = await this.prismaService.registrationInvite.create({
          data: {
            fleetId: actor.fleetId,
            role,
            email: normalizedEmail,
            phone,
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
      } catch (fallbackError: any) {
        this.logger.error(
          `registrationInvite.create fallback failed: ${fallbackError?.message}`,
          fallbackError?.stack,
        );
        throw new InternalServerErrorException(
          fallbackError?.message || 'Failed to create invite code',
        );
      }
    }

    try {
      await this.auditService.createAuditLog({
        fleetId: actor.fleetId,
        actorUserId: actor.id,
        actionType: AuditActionType.USER_INVITED,
        targetType: 'REGISTRATION_INVITE',
        targetId: createdInvite.id,
        metaJson: {
          role: createdInvite.role,
          email: createdInvite.email,
          phone: createdInvite.phone,
          maxUses: createdInvite.maxUses ?? maxUsesVal,
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(
        `Failed to create audit log for invite ${createdInvite.id}: ${auditErr?.message}`,
      );
    }

    return {
      inviteId: createdInvite.id,
      token,
      fleetId: createdInvite.fleetId,
      role: createdInvite.role,
      email: createdInvite.email,
      phone: createdInvite.phone,
      maxUses: createdInvite.maxUses ?? maxUsesVal,
      usedCount: createdInvite.usedCount ?? 0,
      expiresAt: createdInvite.expiresAt,
    };
  }

  // Redeems an invite token and creates the corresponding fleet user.
  async redeemInvite(dto: RedeemInviteDto): Promise<AuthenticatedUser> {
    const registerEnabled = this.configService.get<boolean>(
      'AUTH_REGISTER_ENABLED',
      true,
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

    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      throw new ForbiddenException('Invite code usage limit reached');
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
    await this.assertIdentifierUnique(normalizedEmail, dto.phone);

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
      const createdUser = await this.prismaService.$transaction(
        async (tx) => {
          const initialStatus =
            invite.role === UserRole.RIDER ? 'PENDING_SETUP' : 'ACTIVE';

          const user = await tx.user.create({
            data: {
              fleetId: invite.fleetId,
              role: invite.role,
              email: normalizedEmail ?? invite.email,
              phone: dto.phone ?? invite.phone,
              passwordHash,
              status: initialStatus,
            },
            select: userSelectForAuth,
          });

          if (dto.fullName || invite.role === UserRole.RIDER) {
            await tx.riderProfile.create({
              data: {
                userId: user.id,
                fullName: dto.fullName || 'New Rider',
                licenceNumber: dto.licenceNumber || null,
                identityNumber: dto.identityNumber || null,
                passportPhoto: dto.passportPhoto || null,
                licencePhoto: dto.licencePhoto || null,
                identityCardPhoto: dto.identityCardPhoto || null,
              },
            });
          }

          const newUsedCount = ((invite as any).usedCount ?? 0) + 1;
          const isFullyUsed =
            ((invite as any).maxUses ?? 1) > 0 &&
            newUsedCount >= ((invite as any).maxUses ?? 1);

          try {
            await tx.registrationInvite.update({
              where: { id: invite.id },
              data: {
                usedCount: { increment: 1 },
                status: isFullyUsed ? 'USED' : 'ACTIVE',
                usedAt: now,
                usedByUserId: user.id,
              },
            });
          } catch {
            await tx.registrationInvite.update({
              where: { id: invite.id },
              data: {
                status: 'USED',
                usedAt: now,
                usedByUserId: user.id,
              },
            });
          }

          return user;
        },
        { timeout: 30000 },
      );

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

    if (user.email) {
      this.mailService
        .sendOtpEmail(user.email, token, 'forgot-password')
        .catch((error: unknown) => {
          this.logger.error(
            `Failed to send password-reset OTP email to ${user.email}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        });
    }

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

  // Lists all insurer users in the system.
  async listAllInsurers() {
    const users = await this.prismaService.user.findMany({
      where: { role: UserRole.INSURER },
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

    const isHqStaff = actor.fleetName === 'E-Moto HQ';
    if (
      (newRole === UserRole.INSURER || targetUser.role === UserRole.INSURER) &&
      !isHqStaff
    ) {
      throw new ForbiddenException(
        'Only E-Moto HQ superAdmin can assign or remove insurer roles',
      );
    }

    const canManageRoles =
      actor.role === UserRole.OWNER ||
      actor.role === UserRole.ADMIN ||
      isHqStaff;

    if (!canManageRoles) {
      throw new ForbiddenException(
        'Only fleet owners and admins can assign user roles',
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

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: updated.id,
      metaJson: {
        email: updated.email,
        phone: updated.phone,
        oldRole: targetUser.role,
        newRole: updated.role,
      },
    });

    return updated;
  }

  // Deletes or deactivates a fleet user.
  async deleteFleetUser(actor: AuthenticatedUser, userId: string) {
    const targetUser = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        riderProfile: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.fleetId !== actor.fleetId) {
      throw new ForbiddenException('Cannot modify users outside your fleet');
    }

    if (targetUser.id === actor.id) {
      throw new ForbiddenException('Cannot delete yourself');
    }

    const isHqStaff = actor.fleetName === 'E-Moto HQ';
    const canDeleteUsers =
      actor.role === UserRole.OWNER ||
      actor.role === UserRole.ADMIN ||
      isHqStaff;

    if (!canDeleteUsers) {
      throw new ForbiddenException(
        'Only fleet owners and admins can remove fleet users',
      );
    }

    try {
      // First clean up active assignments and profile
      await this.prismaService.bikeAssignment.updateMany({
        where: { riderUserId: userId, active: true },
        data: { active: false, unassignedAt: new Date() },
      });

      await this.prismaService.user.delete({ where: { id: userId } });

      await this.auditService.createAuditLog({
        fleetId: actor.fleetId,
        actorUserId: actor.id,
        actionType: AuditActionType.USER_ROLE_CHANGED,
        targetType: 'USER',
        targetId: userId,
        metaJson: {
          email: targetUser.email,
          phone: targetUser.phone,
          action: 'DELETED',
        },
      });

      return { success: true, action: 'DELETED' };
    } catch {
      // Fallback to disabling the user
      const updated = await this.prismaService.user.update({
        where: { id: userId },
        data: { status: UserStatus.DISABLED },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      await this.auditService.createAuditLog({
        fleetId: actor.fleetId,
        actorUserId: actor.id,
        actionType: AuditActionType.USER_ROLE_CHANGED,
        targetType: 'USER',
        targetId: userId,
        metaJson: {
          email: targetUser.email,
          phone: targetUser.phone,
          action: 'DISABLED',
        },
      });

      return { success: true, action: 'DISABLED', user: updated };
    }
  }

  // Returns the current authenticated user profile.
  async me(userId: string): Promise<AuthenticatedUser> {
    return this.loadUserOrThrow(userId);
  }

  // Updates the notification preferences of the authenticated user.
  async updateNotificationPrefs(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<AuthenticatedUser> {
    const updated = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        notifOpenIncidents: dto.openIncidents,
        notifSosAlerts: dto.sosAlerts,
        notifCrashEvents: dto.crashEvents,
      },
      select: userSelectForAuth,
    });
    return this.toAuthenticatedUser(updated);
  }

  // Verifies an access token and returns the active user identity.
  async authenticateAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(accessToken);
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Session expired. Please log in again.',
        );
      }
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

    const defaultExpiresIn = (this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '7d',
    ) ?? '7d') as StringValue;
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

  // Asserts that the email and phone number are not already in use by any other account.
  private async assertIdentifierUnique(
    email?: string,
    phone?: string,
  ): Promise<void> {
    const OR: Prisma.UserWhereInput[] = [];
    if (email) {
      OR.push({ email: email.trim().toLowerCase() });
    }
    if (phone) {
      OR.push({ phone: phone.trim() });
    }
    if (OR.length === 0) {
      return;
    }

    const existingUser = await this.prismaService.user.findFirst({
      where: { OR },
    });

    if (existingUser) {
      if (
        email &&
        existingUser.email?.toLowerCase() === email.trim().toLowerCase()
      ) {
        throw new ConflictException(
          'Email is already in use by another account',
        );
      }
      if (phone && existingUser.phone === phone.trim()) {
        throw new ConflictException(
          'Phone number is already in use by another account',
        );
      }
      throw new ConflictException('Email or phone number already in use');
    }
  }

  // Loads a user identity projection or throws unauthorized when missing.
  private async loadUserOrThrow(userId: string): Promise<AuthenticatedUser> {
    try {
      const user = await this.executeAuthUserQuery(() =>
        this.prismaService.user.findUnique({
          where: { id: userId },
          select: userSelectForAuth,
        }),
      );

      if (!user) {
        throw new UnauthorizedException('User session not found');
      }

      return this.toAuthenticatedUser(user);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.warn(
        `Failed to load authentication profile for user ${userId}: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
      throw new UnauthorizedException(
        'Session expired or user profile unavailable',
      );
    }
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

    this.mailService
      .sendOtpEmail(normalizedEmail, otp, dto.reason)
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send verification OTP email to ${normalizedEmail}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      });

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

    const user = await this.executeAuthUserQuery(() =>
      this.prismaService.user.findUnique({
        where: { id: userId },
        select: userSelectForAuth,
      }),
    );

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
      fleetId: user.fleetId ?? '',
      fleetName: user.fleet?.name ?? 'E-Moto Fleet',
      fleetPlan: user.fleet?.plan ?? 'PAYG',
      fleetType: user.fleet?.type ?? 'COOP',
      subscriptionStatus: user.fleet?.subscriptionStatus ?? 'ACTIVE',
      upgradeRequested: user.fleet?.upgradeRequested ?? false,
      role: user.role,
      email: user.email,
      phone: user.phone,
      status: user.status,
      insurerName: user.fleet?.insurerName ?? null,
      monthlyRatePerBike: user.fleet?.monthlyRatePerBike ?? 10500,
      notifOpenIncidents: user.notifOpenIncidents ?? true,
      notifSosAlerts: user.notifSosAlerts ?? true,
      notifCrashEvents: user.notifCrashEvents ?? true,
    };
  }

  // Safely executes database queries that fetch user profiles with relation fields (like Fleet.plan).
  // If an un-sanitized DB row or stale Postgres enum value triggers a Prisma validation error (e.g., "Value 'PREMIUM' not found in enum 'FleetPlan'"),
  // this wrapper automatically invokes PrismaService.sanitizeFleetPlans() and retries the query seamlessly.
  private async executeAuthUserQuery<T>(queryFn: () => Promise<T>): Promise<T> {
    try {
      return await queryFn();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('FleetPlan') || errMsg.includes("enum 'FleetPlan'")) {
        this.logger.warn(
          `Interpreted legacy FleetPlan enum exception: "${errMsg}". Auto-repairing database records...`,
        );
        await this.prismaService.sanitizeFleetPlans();
        return await queryFn();
      }
      throw err;
    }
  }

  // Sends an email notification to bruno@emotofleet.com when a contact form is submitted.
  async sendContactInquiry(
    dto: ContactInquiryDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Received contact inquiry from ${dto.name} (${dto.email}) about category ${dto.category}`,
    );

    const escapedName = this.escapeHtml(dto.name);
    const escapedEmail = this.escapeHtml(dto.email);
    const escapedCategory = this.escapeHtml(dto.category);
    const escapedMessage = this.escapeHtml(dto.message);

    const recipient = 'bruno@emotofleet.com';
    const subject = `eMoto Contact Inquiry: ${escapedCategory} - from ${escapedName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-top: 0;">New Fleet OS Inquiry</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 100px;">Name:</td>
            <td style="padding: 8px 0;">${escapedName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Email:</td>
            <td style="padding: 8px 0;"><a href="mailto:${escapedEmail}">${escapedEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Category:</td>
            <td style="padding: 8px 0; text-transform: capitalize;">${escapedCategory}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px; border-left: 4px solid #2e7d32;">
          <h4 style="margin-top: 0; margin-bottom: 8px; color: #333;">Message:</h4>
          <p style="margin: 0; white-space: pre-wrap; color: #555; line-height: 1.5;">${escapedMessage}</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; margin: 0; text-align: center;">This inquiry was submitted via the contact form on emotofleet.com.</p>
      </div>
    `;

    const success = await this.mailService.sendMail(recipient, subject, html);

    if (!success) {
      throw new BadRequestException('Failed to send email notification');
    }

    return {
      success: true,
      message: 'Inquiry submitted and email notification sent successfully',
    };
  }

  async getPartnerKeys(user: AuthenticatedUser) {
    if (user.fleetPlan !== 'INSURANCE') {
      throw new ForbiddenException(
        'Only insurance fleets can retrieve API keys',
      );
    }
    const client = await this.prismaService.partnerClient.findFirst({
      where: { partnerId: user.id },
      select: { clientId: true },
    });
    if (!client) {
      throw new NotFoundException('Partner client keys not found');
    }
    return { clientId: client.clientId };
  }

  async rotatePartnerKeys(user: AuthenticatedUser) {
    if (user.fleetPlan !== 'INSURANCE') {
      throw new ForbiddenException('Only insurance fleets can rotate API keys');
    }
    const client = await this.prismaService.partnerClient.findFirst({
      where: { partnerId: user.id },
    });
    if (!client) {
      throw new NotFoundException('Partner client keys not found');
    }
    const clientSecret = randomBytes(16).toString('hex');
    const clientSecretHash = await bcrypt.hash(clientSecret, 10);

    await this.prismaService.partnerClient.update({
      where: { id: client.id },
      data: { clientSecretHash },
    });

    return {
      clientId: client.clientId,
      clientSecret,
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
