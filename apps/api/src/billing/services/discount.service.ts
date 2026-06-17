import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Discount, DiscountTarget, DiscountType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';

@Injectable()
export class DiscountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listDiscounts(): Promise<Discount[]> {
    return this.prisma.discount.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        fleet: {
          select: { name: true },
        },
      },
    });
  }

  async getDiscount(id: string): Promise<Discount> {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
    });
    if (!discount) {
      throw new NotFoundException(`Discount with ID ${id} not found`);
    }
    return discount;
  }

  async createDiscount(
    dto: CreateDiscountDto,
    user: AuthenticatedUser,
  ): Promise<Discount> {
    if (dto.code) {
      const existing = await this.prisma.discount.findUnique({
        where: { code: dto.code.toUpperCase() },
      });
      if (existing) {
        throw new BadRequestException(
          `Discount code "${dto.code}" already exists`,
        );
      }
      dto.code = dto.code.toUpperCase();
    }

    const discount = await this.prisma.discount.create({
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        value: dto.value,
        appliesTo: dto.appliesTo,
        maxUses: dto.maxUses,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        fleetId: dto.fleetId,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: 'DISCOUNT_CREATED',
      targetType: 'Discount',
      targetId: discount.id,
      metaJson: { discount },
    });

    return discount;
  }

  async updateDiscount(
    id: string,
    dto: UpdateDiscountDto,
    user: AuthenticatedUser,
  ): Promise<Discount> {
    const current = await this.getDiscount(id);

    if (dto.code && dto.code.toUpperCase() !== current.code) {
      const existing = await this.prisma.discount.findUnique({
        where: { code: dto.code.toUpperCase() },
      });
      if (existing) {
        throw new BadRequestException(
          `Discount code "${dto.code}" already exists`,
        );
      }
      dto.code = dto.code.toUpperCase();
    }

    const updated = await this.prisma.discount.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        value: dto.value,
        appliesTo: dto.appliesTo,
        maxUses: dto.maxUses,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        fleetId: dto.fleetId,
        isActive: dto.isActive,
      },
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: 'DISCOUNT_UPDATED',
      targetType: 'Discount',
      targetId: updated.id,
      metaJson: { before: current, after: updated },
    });

    return updated;
  }

  async deleteDiscount(id: string, user: AuthenticatedUser): Promise<void> {
    await this.getDiscount(id);

    await this.prisma.discount.delete({
      where: { id },
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: 'FLEET_DELETED', // Reusing FLEET_DELETED or soft-delete target
      targetType: 'Discount',
      targetId: id,
      metaJson: { id },
    });
  }

  async validateDiscountCode(
    code: string,
    fleetId: string,
    originalAmount: number,
    target: 'setup' | 'subscription',
  ): Promise<{ discount: Discount; discountAmount: number }> {
    const discount = await this.prisma.discount.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discount || !discount.isActive) {
      throw new BadRequestException('Invalid or inactive discount code');
    }

    if (discount.fleetId && discount.fleetId !== fleetId) {
      throw new BadRequestException(
        'This discount code is not valid for your fleet',
      );
    }

    const now = new Date();
    if (discount.validFrom && discount.validFrom > now) {
      throw new BadRequestException('This discount code is not valid yet');
    }
    if (discount.validUntil && discount.validUntil < now) {
      throw new BadRequestException('This discount code has expired');
    }

    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      throw new BadRequestException(
        'This discount code usage limit has been reached',
      );
    }

    const appliesTo = discount.appliesTo;
    const isApplies =
      appliesTo === DiscountTarget.BOTH ||
      (target === 'setup' && appliesTo === DiscountTarget.SETUP_FEE) ||
      (target === 'subscription' && appliesTo === DiscountTarget.SUBSCRIPTION);

    if (!isApplies) {
      throw new BadRequestException(
        `This discount is only applicable to ${appliesTo.toLowerCase().replace('_', ' ')}`,
      );
    }

    let discountAmount = 0;
    if (discount.type === DiscountType.PERCENTAGE) {
      const percentage = Number(discount.value);
      discountAmount = Math.round(originalAmount * (percentage / 100));
    } else {
      discountAmount = Math.min(Number(discount.value), originalAmount);
    }

    return { discount, discountAmount };
  }
}
