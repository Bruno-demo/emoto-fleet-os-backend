import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus } from '@prisma/client';
import {
  BackoffOptions,
  ConnectionOptions,
  JobsOptions,
  Queue,
  QueueEvents,
  Worker,
} from 'bullmq';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { NotificationDispatchInput } from './incidents.types';
import { NOTIFICATION_PROVIDER } from './notification-provider';
import type { NotificationProvider } from './notification-provider';

interface NotificationJobPayload {
  notificationId: string;
}

interface NotificationFailedEventPayload {
  jobId?: string;
  failedReason?: string;
  attemptsMade?: number | string;
}

const NOTIFICATION_QUEUE_NAME = 'notification-outbox';
const NOTIFICATION_ATTEMPTS = 3;
const NOTIFICATION_BACKOFF_DELAY_MS = 2_000;
const PENDING_NOTIFICATION_BOOTSTRAP_LIMIT = 500;
const NOTIFICATION_JOB_PREFIX = 'notification-';

@Injectable()
export class NotificationOutboxService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationOutboxService.name);
  private readonly inlineMode: boolean;
  private readonly connection: ConnectionOptions;
  private queue: Queue<NotificationJobPayload> | null = null;
  private worker: Worker<NotificationJobPayload> | null = null;
  private queueEvents: QueueEvents | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
  ) {
    this.inlineMode = this.configService.get<boolean>(
      'NOTIFICATION_OUTBOX_INLINE',
      false,
    );
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.connection = this.buildBullMqConnection(redisUrl);
  }

  // Boots queue worker and schedules any pending notification rows for dispatch.
  async onModuleInit(): Promise<void> {
    if (this.inlineMode) {
      await this.enqueuePendingNotifications();
      return;
    }

    this.queue = new Queue<NotificationJobPayload>(NOTIFICATION_QUEUE_NAME, {
      connection: this.connection,
    });

    this.queueEvents = new QueueEvents(NOTIFICATION_QUEUE_NAME, {
      connection: this.connection,
    });
    this.queueEvents.on('failed', (event: NotificationFailedEventPayload) => {
      const attemptsMade = this.normalizeAttemptsMade(event.attemptsMade);
      void this.handleFailedJob(
        event.jobId,
        this.normalizeFailedReason(event.failedReason),
        attemptsMade,
      );
    });

    this.worker = new Worker<NotificationJobPayload>(
      NOTIFICATION_QUEUE_NAME,
      async (job) => {
        await this.processNotificationJob(job.data.notificationId);
      },
      {
        connection: this.connection,
        concurrency: 5,
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            const base = NOTIFICATION_BACKOFF_DELAY_MS * Math.pow(2, attemptsMade - 1);
            const jitter = Math.random() * base * 0.3;
            return Math.round(base + jitter);
          },
        },
      },
    );

    await this.queue.waitUntilReady();
    await this.queueEvents.waitUntilReady();
    await this.worker.waitUntilReady();

    await this.enqueuePendingNotifications();
  }

  // Gracefully shuts down queue resources during process termination.
  async onModuleDestroy(): Promise<void> {
    if (this.inlineMode) {
      return;
    }

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queueEvents) {
      await this.queueEvents.close();
      this.queueEvents = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  // Enqueues one notification id for asynchronous provider delivery.
  async enqueueNotification(notificationId: string): Promise<void> {
    if (this.inlineMode) {
      try {
        await this.processNotificationJob(notificationId);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Notification dispatch failed';
        await this.handleInlineFailure(notificationId, message);
      }
      return;
    }

    if (!this.queue) {
      return;
    }

    await this.queue.add(
      'dispatch-notification',
      { notificationId },
      this.defaultJobOptions(notificationId),
    );
  }

  // Enqueues all pending notifications so outbox processing can resume after restarts.
  async enqueuePendingNotifications(): Promise<void> {
    if (!this.queue && !this.inlineMode) {
      return;
    }

    const pendingNotifications = await this.prismaService.notification.findMany(
      {
        where: {
          status: NotificationStatus.PENDING,
        },
        orderBy: { createdAt: 'asc' },
        take: PENDING_NOTIFICATION_BOOTSTRAP_LIMIT,
        select: { id: true },
      },
    );

    for (const notification of pendingNotifications) {
      await this.enqueueNotification(notification.id);
    }
  }

  // Marks inline-mode notifications as failed without requiring BullMQ retries.
  private async handleInlineFailure(
    notificationId: string,
    reason: string,
  ): Promise<void> {
    await this.prismaService.notification.updateMany({
      where: {
        id: notificationId,
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.FAILED,
        errorMessage: reason.slice(0, 1000),
      },
    });
  }

  // Processes a single notification row and marks it as SENT on successful dispatch.
  private async processNotificationJob(notificationId: string): Promise<void> {
    const notification = await this.prismaService.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.status !== NotificationStatus.PENDING) {
      return;
    }

    await this.prismaService.notification.update({
      where: { id: notification.id },
      data: {
        attemptCount: {
          increment: 1,
        },
        errorMessage: null,
      },
    });

    const dispatchInput: NotificationDispatchInput = {
      id: notification.id,
      fleetId: notification.fleetId,
      type: notification.type,
      channel: notification.channel,
      to: notification.to,
      payloadJson: notification.payloadJson,
      partnerWebhookId: notification.partnerWebhookId,
      attemptCount: notification.attemptCount + 1,
    };

    await this.notificationProvider.send(dispatchInput);

    await this.prismaService.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      },
    });

    if (notification.channel === 'WEBHOOK') {
      await this.auditService.createAuditLog({
        fleetId: notification.fleetId,
        actionType: 'PARTNER_WEBHOOK_DELIVERY',
        targetType: 'Notification',
        targetId: notification.id,
        metaJson: {
          status: 'SENT',
          attemptCount: notification.attemptCount + 1,
        },
      });
    }
  }

  // Marks notifications as FAILED when their final retry attempt is exhausted.
  private async handleFailedJob(
    jobId: string | undefined,
    reason: string,
    attemptsMade: number,
  ): Promise<void> {
    if (!jobId) {
      return;
    }

    const notificationId = this.parseNotificationIdFromJob(jobId);
    if (!notificationId) {
      return;
    }

    if (attemptsMade < NOTIFICATION_ATTEMPTS) {
      await this.prismaService.notification.updateMany({
        where: {
          id: notificationId,
          status: NotificationStatus.PENDING,
        },
        data: {
          errorMessage: `Retry ${attemptsMade}/${NOTIFICATION_ATTEMPTS}: ${reason.slice(0, 900)}`,
        },
      });
      return;
    }

    await this.prismaService.notification.updateMany({
      where: {
        id: notificationId,
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.FAILED,
        errorMessage: reason.slice(0, 1000),
      },
    });

    const failedNotification = await this.prismaService.notification.findUnique(
      {
        where: { id: notificationId },
        select: {
          fleetId: true,
          channel: true,
        },
      },
    );
    if (failedNotification?.channel === 'WEBHOOK') {
      await this.auditService.createAuditLog({
        fleetId: failedNotification.fleetId,
        actionType: 'PARTNER_WEBHOOK_DELIVERY',
        targetType: 'Notification',
        targetId: notificationId,
        metaJson: {
          status: 'FAILED',
          attemptsMade,
        },
      });
    }
  }

  // Creates default retry/backoff behavior used for notification outbox jobs.
  private defaultJobOptions(notificationId: string): JobsOptions {
    const backoff: BackoffOptions = {
      type: 'custom',
      delay: NOTIFICATION_BACKOFF_DELAY_MS,
    };

    return {
      jobId: this.jobIdForNotification(notificationId),
      attempts: NOTIFICATION_ATTEMPTS,
      backoff,
      removeOnComplete: true,
      removeOnFail: 1_000,
    };
  }

  // Generates stable queue job identifiers for deduplicating notification jobs.
  private jobIdForNotification(notificationId: string): string {
    return `${NOTIFICATION_JOB_PREFIX}${notificationId}`;
  }

  // Resolves notification ids from queue job ids in failure callbacks.
  private parseNotificationIdFromJob(jobId: string): string | null {
    if (!jobId.startsWith(NOTIFICATION_JOB_PREFIX)) {
      return null;
    }

    return jobId.slice(NOTIFICATION_JOB_PREFIX.length);
  }

  // Builds BullMQ redis connection options from REDIS_URL.
  private buildBullMqConnection(redisUrl: string): ConnectionOptions {
    const parsed = new URL(redisUrl);
    const dbPath = parsed.pathname.replace('/', '').trim();
    const username = parsed.username
      ? decodeURIComponent(parsed.username)
      : undefined;
    const password = parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined;

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      db: dbPath ? Number(dbPath) : 0,
      username,
      password,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  // Coerces queue attempts payload to a safe finite number.
  private normalizeAttemptsMade(
    attemptsMade: number | string | undefined,
  ): number {
    const parsed =
      typeof attemptsMade === 'number'
        ? attemptsMade
        : Number(attemptsMade ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Provides a stable reason string for failed jobs.
  private normalizeFailedReason(reason: string | undefined): string {
    return reason && reason.trim().length > 0
      ? reason
      : 'Notification dispatch failed';
  }
}
