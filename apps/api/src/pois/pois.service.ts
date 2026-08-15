import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePoiDto } from './dto/create-poi.dto';
import { ListPoisDto } from './dto/list-pois.dto';
import {
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';

@Injectable()
export class PoisService {
  constructor(private readonly prisma: PrismaService) {}

  async listPois(query: ListPoisDto) {
    const pagination = getPaginationParams(query);
    const whereAnd: Prisma.PoiWhereInput[] = [];

    if (query.type) {
      whereAnd.push({ type: query.type });
    }

    if (query.active !== undefined && query.active !== '') {
      whereAnd.push({ active: query.active === 'true' });
    }

    if (query.fleetId) {
      whereAnd.push({
        OR: [{ fleetId: query.fleetId }, { fleetId: null }],
      });
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      whereAnd.push({
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.PoiWhereInput =
      whereAnd.length > 0 ? { AND: whereAnd } : {};

    const [pois, total] = await Promise.all([
      this.prisma.poi.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.poi.count({ where }),
    ]);

    const formattedPois = pois.map((poi) => ({
      ...poi,
      lat: Number(poi.lat),
      lng: Number(poi.lng),
    }));

    return createPaginatedResponse(
      formattedPois,
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getPoi(id: string) {
    const poi = await this.prisma.poi.findUnique({
      where: { id },
    });
    if (!poi) {
      throw new NotFoundException('POI not found');
    }
    return {
      ...poi,
      lat: Number(poi.lat),
      lng: Number(poi.lng),
    };
  }

  async createPoi(dto: CreatePoiDto) {
    const poi = await this.prisma.poi.create({
      data: {
        fleetId: dto.fleetId || null,
        type: dto.type,
        name: dto.name,
        phone: dto.phone || null,
        lat: dto.lat,
        lng: dto.lng,
        address: dto.address || null,
        active: dto.active ?? true,
        supportedBikeTypes: dto.supportedBikeTypes || [],
        fullSwapFeeRwf: dto.fullSwapFeeRwf ?? 2500,
        halfSwapFeeRwf: dto.halfSwapFeeRwf ?? 1250,
        quarterSwapFeeRwf: dto.quarterSwapFeeRwf ?? 625,
      },
    });

    return {
      ...poi,
      lat: Number(poi.lat),
      lng: Number(poi.lng),
    };
  }

  async updatePoi(id: string, dto: Partial<CreatePoiDto>) {
    await this.getPoi(id);

    const poi = await this.prisma.poi.update({
      where: { id },
      data: {
        fleetId: dto.fleetId !== undefined ? dto.fleetId : undefined,
        type: dto.type,
        name: dto.name,
        phone: dto.phone,
        lat: dto.lat,
        lng: dto.lng,
        address: dto.address,
        active: dto.active,
        supportedBikeTypes: dto.supportedBikeTypes,
        fullSwapFeeRwf: dto.fullSwapFeeRwf,
        halfSwapFeeRwf: dto.halfSwapFeeRwf,
        quarterSwapFeeRwf: dto.quarterSwapFeeRwf,
      },
    });

    return {
      ...poi,
      lat: Number(poi.lat),
      lng: Number(poi.lng),
    };
  }

  async deletePoi(id: string) {
    await this.getPoi(id);
    await this.prisma.poi.delete({
      where: { id },
    });
    return { success: true };
  }
}
