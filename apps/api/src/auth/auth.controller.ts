import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from './current-user.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { LoginDto } from './dto/login.dto';
import { PublicRegisterDto } from './dto/public-register.dto';
import { RedeemInviteDto } from './dto/redeem-invite.dto';
import { RegisterDto } from './dto/register.dto';
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
    default: { limit: 8, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Login with email/password or phone/password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    const result = await this.authService.login(dto);
    this.setAuthCookie(response, result.accessToken);
    return result;
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the access token cookie' })
  async logout(@Res({ passthrough: true }) response: Response): Promise<{
    ok: true;
  }> {
    this.clearAuthCookie(response);
    return { ok: true };
  }

  @Post('register')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @Throttle({
    default: { limit: 5, ttl: 60_000 },
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
    default: { limit: 5, ttl: 60_000 },
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

  @Post('register-public')
  @Public()
  @Throttle({
    default: { limit: 3, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Public registration for rider accounts (disabled by default)',
  })
  async registerPublic(
    @Body() dto: PublicRegisterDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.registerPublic(dto);
  }

  @Post('register-invite')
  @Public()
  @Throttle({
    default: { limit: 3, ttl: 60_000 },
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
  private setAuthCookie(response: Response, token: string): void {
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'emoto_access_token',
    );
    const secure = this.configService.get<boolean>(
      'AUTH_COOKIE_SECURE',
      false,
    );
    const configuredSameSite = this.configService.get<
      'lax' | 'strict' | 'none'
    >('AUTH_COOKIE_SAMESITE', 'lax');
    const sameSite =
      configuredSameSite === 'none' && !secure ? 'lax' : configuredSameSite;
    const domain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');

    response.cookie(cookieName, token, {
      httpOnly: true,
      secure: secure || configuredSameSite === 'none',
      sameSite,
      path: '/',
      domain: domain || undefined,
    });
  }

  // Clears the httpOnly auth cookie in browser sessions.
  private clearAuthCookie(response: Response): void {
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'emoto_access_token',
    );
    const domain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');
    response.clearCookie(cookieName, {
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
