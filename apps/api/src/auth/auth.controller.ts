import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
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
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({
    default: { limit: 8, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Login with email/password or phone/password' })
  async login(@Body() dto: LoginDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    return this.authService.login(dto);
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
