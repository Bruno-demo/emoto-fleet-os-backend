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
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { PublicRegisterDto } from './dto/public-register.dto';
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
