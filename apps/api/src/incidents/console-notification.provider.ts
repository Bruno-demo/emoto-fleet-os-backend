import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { decryptDeviceSecret } from '../crypto/device-secret.crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationProvider } from './notification-provider';
import { NotificationDispatchInput } from './incidents.types';

@Injectable()
export class ConsoleNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(ConsoleNotificationProvider.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // Sends notification payloads to the console for local development.
  async send(input: NotificationDispatchInput): Promise<void> {
    if (input.channel === 'WEBHOOK') {
      await this.sendWebhookNotification(input);
      return;
    }

    this.logger.log(
      `Notification sent type=${input.type} channel=${input.channel} to=${this.maskRecipient(input.to)}`,
    );
  }

  // Masks recipient addresses to avoid leaking PII in application logs.
  private maskRecipient(recipient: string): string {
    const trimmed = recipient.trim();
    if (trimmed.length <= 4) {
      return '***';
    }

    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }

  // Sends signed webhook notifications using partner-managed shared secrets.
  private async sendWebhookNotification(
    input: NotificationDispatchInput,
  ): Promise<void> {
    if (!input.partnerWebhookId) {
      throw new Error('Missing partner webhook id for webhook notification');
    }

    const webhook = await this.prismaService.partnerWebhook.findUnique({
      where: {
        id: input.partnerWebhookId,
      },
      select: {
        id: true,
        url: true,
        active: true,
        secretHash: true,
        secretEncrypted: true,
      },
    });

    if (!webhook) {
      throw new Error('Partner webhook not found');
    }
    if (!webhook.active) {
      this.logger.warn(
        `Skipping inactive webhook delivery id=${webhook.id} host=${this.maskWebhookHost(webhook.url)}`,
      );
      return;
    }

    const payload = this.normalizeWebhookPayload(input.payloadJson);
    const payloadString = JSON.stringify(payload);
    const secret = this.resolveWebhookSecret(
      webhook.secretEncrypted,
      webhook.secretHash,
    );
    const signature = createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
    const timestamp = new Date().toISOString();

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-emoto-signature': signature,
        'x-emoto-timestamp': timestamp,
      },
      body: payloadString,
    });
    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }

    this.logger.log(
      `Webhook delivered id=${webhook.id} host=${this.maskWebhookHost(webhook.url)} attempts=${input.attemptCount}`,
    );
  }

  // Normalizes payloads to object envelopes for deterministic webhook signatures.
  private normalizeWebhookPayload(
    payloadJson: Prisma.JsonValue,
  ): Prisma.JsonObject {
    if (
      payloadJson &&
      typeof payloadJson === 'object' &&
      !Array.isArray(payloadJson)
    ) {
      return payloadJson;
    }

    return {
      data: payloadJson,
    };
  }

  // Resolves decrypted webhook secrets for signing while preserving hashed fallback support.
  private resolveWebhookSecret(
    secretEncrypted: string | null,
    secretHash: string,
  ): string {
    if (!secretEncrypted) {
      return secretHash;
    }

    const secretMasterKey = this.configService.get<string>(
      'PARTNER_WEBHOOK_SECRET_MASTER_KEY',
    )
      ? this.configService.getOrThrow<string>(
          'PARTNER_WEBHOOK_SECRET_MASTER_KEY',
        )
      : this.configService.getOrThrow<string>('DEVICE_SECRET_MASTER_KEY');

    return decryptDeviceSecret(secretEncrypted, secretMasterKey);
  }

  // Extracts and masks webhook hosts before writing transport logs.
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
