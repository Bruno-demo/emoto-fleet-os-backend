import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from './current-user.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { PublicRegisterDto } from './dto/public-register.dto';
import { RedeemInviteDto } from './dto/redeem-invite.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterFleetDto } from './dto/register-fleet.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginOtpDto } from './dto/login-otp.dto';
import { RegisterSelfDto } from './dto/register-self.dto';
import type { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Login with email/password or phone/password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<
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
    const result = await this.authService.login(dto);
    if ('accessToken' in result) {
      this.setAuthCookie(response, result.accessToken, dto.rememberMe ?? false);
    }
    return result;
  }

  @Post('send-otp')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Send email OTP verification code' })
  async sendOtp(
    @Body() dto: SendOtpDto,
  ): Promise<{ message: string; otp?: string }> {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Verify email OTP' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.verifyOtp(dto);
  }

  @Post('login-otp')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Verify login OTP and complete authentication' })
  async loginWithOtp(
    @Body() dto: LoginOtpDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    const result = await this.authService.loginWithOtp(dto);
    this.setAuthCookie(response, result.accessToken, result.rememberMe);
    return {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      user: result.user,
    };
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the access token cookie' })
  logout(@Res({ passthrough: true }) response: Response): {
    ok: true;
  } {
    this.clearAuthCookie(response);
    return { ok: true };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: { limit: 5, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Request password reset with email or phone' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string; token?: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: { limit: 5, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Reset password using recovery token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.resetPassword(dto);
  }

  @Post('register')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Register a user in the caller fleet (disabled by default)',
  })
  async register(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RegisterDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.register(actor, dto);
  }

  @Post('invites')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Create a one-time invite token for registration',
  })
  async createInvite(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ): Promise<{
    inviteId: string;
    token: string;
    fleetId: string;
    role: UserRole;
    email: string | null;
    phone: string | null;
    expiresAt: Date;
  }> {
    return this.authService.createInvite(actor, dto);
  }

  @Get('fleet-users')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.RIDER)
  @ApiOperation({ summary: 'List all users in the caller fleet' })
  async listFleetUsers(@CurrentUser() actor: AuthenticatedUser) {
    return this.authService.listFleetUsers(actor);
  }

  @Put('fleet-users/:id/role')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Change a fleet user role' })
  async changeFleetUserRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: { role: string },
  ) {
    return this.authService.changeFleetUserRole(
      actor,
      userId,
      body.role as UserRole,
    );
  }

  @Post('register-fleet')
  @Public()
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Create a new fleet and register as admin',
  })
  async registerFleet(
    @Body() dto: RegisterFleetDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.registerFleet(dto);
  }

  @Post('register-public')
  @Public()
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Public registration for rider accounts (disabled by default)',
  })
  async registerPublic(
    @Body() dto: PublicRegisterDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.registerPublic(dto);
  }

  @Post('register-self')
  @Public()
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary:
      'Public registration for self-bike owner (self driver) rider accounts',
  })
  async registerSelf(@Body() dto: RegisterSelfDto): Promise<AuthenticatedUser> {
    return this.authService.registerSelfDriver(dto);
  }

  @Post('register-invite')
  @Public()
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Redeem an invite token and register a fleet user',
  })
  async registerWithInvite(
    @Body() dto: RedeemInviteDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.redeemInvite(dto);
  }

  // Sets the httpOnly auth cookie used by browser clients.
  private setAuthCookie(
    response: Response,
    token: string,
    rememberMe: boolean,
  ): void {
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'emoto_access_token',
    );
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const secure = isProd
      ? true
      : this.configService.get<boolean>('AUTH_COOKIE_SECURE', false);
    const configuredSameSite = this.configService.get<
      'lax' | 'strict' | 'none'
    >('AUTH_COOKIE_SAMESITE', 'lax');
    const sameSite = isProd
      ? 'none'
      : configuredSameSite === 'none' && !secure
        ? 'lax'
        : configuredSameSite;
    const domain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');
    const rememberDays = this.configService.get<number>(
      'AUTH_REMEMBER_ME_DAYS',
      30,
    );
    const maxAgeMs = rememberMe
      ? rememberDays * 24 * 60 * 60 * 1000
      : undefined;

    response.cookie(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: domain || undefined,
      maxAge: maxAgeMs,
    });
  }

  // Clears the httpOnly auth cookie in browser sessions.
  // Attributes must match setAuthCookie so the browser identifies the correct cookie.
  private clearAuthCookie(response: Response): void {
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'emoto_access_token',
    );
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const secure = isProd
      ? true
      : this.configService.get<boolean>('AUTH_COOKIE_SECURE', false);
    const configuredSameSite = this.configService.get<
      'lax' | 'strict' | 'none'
    >('AUTH_COOKIE_SAMESITE', 'lax');
    const sameSite = isProd
      ? 'none'
      : configuredSameSite === 'none' && !secure
        ? 'lax'
        : configuredSameSite;
    const domain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');
    response.clearCookie(cookieName, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: domain || undefined,
    });
  }
}

@ApiTags('auth')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return current authenticated user' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return this.authService.me(user.id);
  }
}
