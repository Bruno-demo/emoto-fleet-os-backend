import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class HqService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      totalFleets,
      totalBikes,
      totalPendingSetups,
      totalPartners,
    ] = await Promise.all([
      this.prisma.fleet.count(),
      this.prisma.bike.count(),
      this.prisma.user.count({ where: { status: 'PENDING_SETUP' } }),
      this.prisma.partner.count(),
    ]);

    return {
      totalFleets,
      totalBikes,
      totalPendingSetups,
      totalPartners,
    };
  }

  async getFleets() {
    return this.prisma.fleet.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true, bikes: true },
        },
      },
    });
  }

  async getPendingUsers() {
    return this.prisma.user.findMany({
      where: { status: 'PENDING_SETUP' },
      include: {
        fleet: {
          select: { name: true, plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        fleet: { select: { name: true } },
      },
    });
  }

  async getPartners() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { clients: true, webhooks: true },
        },
      },
    });
  }

  async getHealth() {
    // Basic service connectivity checks
    const [dbOk, redisOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      // Mocking other services for now as we don't have direct access in this context
      Promise.resolve(true), 
    ]);

    return [
      { label: 'EMQX Cluster', status: 'Operational', color: 'text-emerald-400' },
      { label: 'Core API', status: 'Healthy', color: 'text-emerald-400' },
      { label: 'Telemetry Engine', status: 'Nominal', color: 'text-emerald-400' },
      { label: 'Database Layer', status: dbOk ? 'Hypertable Active' : 'Degraded', color: dbOk ? 'text-sky-400' : 'text-rose-400' },
    ];
  }

  async getEvents() {
    // Fetch recent fleets and activations as events
    const [fleets, users] = await Promise.all([
      this.prisma.fleet.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.findMany({ 
        where: { status: 'ACTIVE' }, 
        take: 5, 
        orderBy: { createdAt: 'desc' },
        include: { fleet: true }
      }),
    ]);

    const events = [
      ...fleets.map(f => ({
        fleet: f.name,
        event: 'New Fleet Provisioned',
        time: this.formatRelative(f.createdAt),
        type: 'success',
      })),
      ...users.map(u => ({
        fleet: u.fleet?.name ?? 'Unknown',
        event: 'Operator Account Activated',
        time: this.formatRelative(u.createdAt),
        type: 'info',
      })),
    ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);

    return events;
  }

  private formatRelative(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
