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
  private readonly connection: ConnectionOptions;
  private queue: Queue<NotificationJobPayload> | null = null;
  private worker: Worker<NotificationJobPayload> | null = null;
  private queueEvents: QueueEvents | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
  ) {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.connection = this.buildBullMqConnection(redisUrl);
  }

  // Boots queue worker and schedules any pending notification rows for dispatch.
  async onModuleInit(): Promise<void> {
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
      },
    );

    await this.queue.waitUntilReady();
    await this.queueEvents.waitUntilReady();
    await this.worker.waitUntilReady();

    await this.enqueuePendingNotifications();
  }

  // Gracefully shuts down queue resources during process termination.
  async onModuleDestroy(): Promise<void> {
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
    if (!this.queue) {
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

  // Processes a single notification row and marks it as SENT on successful dispatch.
  private async processNotificationJob(notificationId: string): Promise<void> {
    const notification = await this.prismaService.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.status !== NotificationStatus.PENDING) {
      return;
    }

    const dispatchInput: NotificationDispatchInput = {
      id: notification.id,
      fleetId: notification.fleetId,
      type: notification.type,
      channel: notification.channel,
      to: notification.to,
      payloadJson: notification.payloadJson,
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
  }

  // Marks notifications as FAILED when their final retry attempt is exhausted.
  private async handleFailedJob(
    jobId: string | undefined,
    reason: string,
    attemptsMade: number,
  ): Promise<void> {
    if (!jobId || attemptsMade < NOTIFICATION_ATTEMPTS) {
      return;
    }

    const notificationId = this.parseNotificationIdFromJob(jobId);
    if (!notificationId) {
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
  }

  // Creates default retry/backoff behavior used for notification outbox jobs.
  private defaultJobOptions(notificationId: string): JobsOptions {
    const backoff: BackoffOptions = {
      type: 'exponential',
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
