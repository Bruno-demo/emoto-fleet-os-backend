import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationChannel,
  NotificationType,
  PartnerStatus,
  Prisma,
} from '@prisma/client';
import Redis from 'ioredis';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationOutboxService } from '../incidents/notification-outbox.service';

interface StreamEntryPayload {
  [key: string]: string | undefined;
}

@Injectable()
export class WebhookDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private readonly streamKey: string;
  private readonly streamGroup: string;
  private readonly streamConsumer: string;
  private readonly pollMs: number;
  private readonly redis: Redis;
  private stopped = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly auditService: AuditService,
  ) {
    this.streamKey = this.configService.get<string>(
      'STREAM_WEBHOOK_KEY',
      'webhooks:outbox',
    );
    this.streamGroup = this.configService.get<string>(
      'WEBHOOK_STREAM_GROUP',
      'webhook-dispatchers',
    );
    this.streamConsumer = `dispatcher-${process.pid}`;
    this.pollMs = this.configService.get<number>(
      'WEBHOOK_STREAM_POLL_MS',
      1000,
    );

    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  // Boots the dispatcher and begins consuming webhook stream entries.
  async onModuleInit(): Promise<void> {
    await this.redis.connect();
    await this.ensureGroup();
    void this.pollLoop();
  }

  // Shuts down the dispatcher loop and closes Redis connections.
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.redis.quit();
  }

  // Creates the Redis consumer group if it does not already exist.
  private async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.streamKey,
        this.streamGroup,
        '$',
        'MKSTREAM',
      );
      this.logger.log(`Webhook stream group created: ${this.streamGroup}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        return;
      }
      throw error;
    }
  }

  // Converts Redis stream field arrays into a plain object.
  private toFieldMap(fields: string[]): StreamEntryPayload {
    const mapped: StreamEntryPayload = {};
    for (let index = 0; index < fields.length; index += 2) {
      mapped[fields[index]] = fields[index + 1];
    }
    return mapped;
  }

  // Main loop that reads new webhook entries from Redis Streams.
  private async pollLoop(): Promise<void> {
    while (!this.stopped) {
      const result = (await (
        this.redis as unknown as {
          xreadgroup: (...args: string[]) => Promise<unknown>;
        }
      ).xreadgroup(
        'GROUP',
        this.streamGroup,
        this.streamConsumer,
        'BLOCK',
        this.pollMs.toString(),
        'COUNT',
        '50',
        'STREAMS',
        this.streamKey,
        '>',
      )) as Array<[string, Array<[string, string[]]>]> | null;

      if (!result) {
        continue;
      }

      for (const [, entries] of result) {
        for (const [entryId, fields] of entries) {
          await this.processEntry(entryId, fields);
        }
      }
    }
  }

  // Dispatches a single webhook stream entry into Notification outbox rows.
  private async processEntry(entryId: string, fields: string[]): Promise<void> {
    const payload = this.toFieldMap(fields);
    try {
      const fleetId = payload.fleetId ?? '';
      const eventType = payload.type ?? '';
      const notificationType = this.resolveNotificationType(eventType);
      if (!fleetId || !notificationType) {
        await this.redis.xack(this.streamKey, this.streamGroup, entryId);
        return;
      }

      const webhooks = await this.prismaService.partnerWebhook.findMany({
        where: {
          active: true,
          partner: {
            status: PartnerStatus.ACTIVE,
            fleetAccesses: {
              some: {
                fleetId,
                active: true,
              },
            },
          },
        },
        select: {
          id: true,
          url: true,
          partnerId: true,
        },
      });

      const payloadEnvelope: Prisma.InputJsonValue = {
        event: 'fleet.alert',
        data: {
          sourceEntryId: entryId,
          fleetId,
          bikeId: payload.bikeId ?? null,
          deviceId: payload.deviceId ?? null,
          ts: payload.ts ?? new Date().toISOString(),
          type: eventType,
          severity: payload.severity ?? null,
          meta: this.safeJsonParse(payload.metaJson),
        },
      };

      for (const webhook of webhooks) {
        const notification = await this.prismaService.notification.create({
          data: {
            fleetId,
            type: notificationType,
            channel: NotificationChannel.WEBHOOK,
            to: webhook.url,
            partnerWebhookId: webhook.id,
            payloadJson: payloadEnvelope,
          },
          select: { id: true },
        });

        await this.notificationOutboxService.enqueueNotification(
          notification.id,
        );
        await this.auditService.createAuditLog({
          fleetId,
          actionType: 'PARTNER_WEBHOOK_DELIVERY',
          targetType: 'Notification',
          targetId: notification.id,
          metaJson: {
            partnerId: webhook.partnerId,
            webhookId: webhook.id,
            webhookHost: this.maskWebhookHost(webhook.url),
            status: 'PENDING',
          },
        });
      }

      // Only ACK after successful processing.
      await this.redis.xack(this.streamKey, this.streamGroup, entryId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Webhook stream processing failed';
      this.logger.warn(
        `Webhook stream entry ${entryId} failed (will be retried): ${message}`,
      );
      // Do NOT ACK — the entry remains pending for re-delivery.
    }
  }

  // Maps event types to notification types for webhook dispatching.
  private resolveNotificationType(eventType: string): NotificationType | null {
    if (eventType === 'CRASH') {
      return NotificationType.CRASH_ALERT;
    }
    if (eventType === 'SOS') {
      return NotificationType.SOS_ALERT;
    }
    if (eventType === 'THEFT_SUSPECTED') {
      return NotificationType.THEFT_ALERT;
    }
    if (eventType.startsWith('delivery.')) {
      return NotificationType.DELIVERY_UPDATE;
    }
    return null;
  }

  // Parses JSON payloads safely without throwing in stream processing.
  private safeJsonParse(value: string | undefined): Prisma.InputJsonValue {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return { data: parsed } as Prisma.InputJsonValue;
    } catch {
      return { raw: value };
    }
  }

  // Masks webhook hosts before storing them in audit logs.
  private maskWebhookHost(urlValue: string): string {
    try {
      const host = new URL(urlValue).host;
      if (host.length <= 6) {
        return '***';
      }
      return `${host.slice(0, 3)}***${host.slice(-2)}`;
    } catch {
      return 'invalid-host';
    }
  }
}
