import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { decryptDeviceSecret } from '../crypto/device-secret.crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationProvider } from './notification-provider';
import { NotificationDispatchInput } from './incidents.types';

@Injectable()
export class ConsoleNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(ConsoleNotificationProvider.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // Sends notification payloads to the console or uses providers for email/webhooks.
  async send(input: NotificationDispatchInput): Promise<void> {
    if (input.channel === 'WEBHOOK') {
      await this.sendWebhookNotification(input);
      return;
    }

    if (input.channel === 'EMAIL') {
      const payload = input.payloadJson as any;
      const subject = input.type === 'CRASH_ALERT' ? '⚠️ eMoto Crash Alert' : '🚨 eMoto SOS Triggered';
      const html = input.type === 'CRASH_ALERT'
        ? this.buildCrashEmailHtml(input.to, payload)
        : this.buildSosEmailHtml(input.to, payload);

      const success = await this.mailService.sendMail(input.to, subject, html);
      if (!success) {
        throw new Error('Failed to send notification email');
      }
      return;
    }

    this.logger.log(
      `Notification sent type=${input.type} channel=${input.channel} to=${this.maskRecipient(input.to)}`,
    );
  }

  private buildCrashEmailHtml(to: string, payload: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>eMoto Crash Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d0d0e; color: #e4e4e7;">
  <div style="width: 100%; background-color: #0d0d0e; padding: 40px 20px; box-sizing: border-box;">
    <div style="max-width: 580px; margin: 0 auto; background-color: #161617; border: 1px solid #27272a; border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4); box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 22px; font-weight: 800; color: #ef4444; letter-spacing: 0.1em; text-transform: uppercase; margin: 0;">eMoto</h1>
        <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 5px;">Incident Desk Alert</div>
      </div>
      
      <div style="font-size: 15px; line-height: 1.6; color: #d4d4d8; margin-bottom: 30px;">
        <p>Hello,</p>
        <p>An urgent <strong style="color: #ef4444;">Crash Event</strong> has been detected for a vehicle in your fleet.</p>
        
        <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; padding: 20px 25px; margin: 25px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; width: 120px; border-b: 1px solid #27272a;">Bike ID</td>
              <td style="padding: 8px 0; font-weight: bold; color: #ffffff;">${payload.bikeId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; border-b: 1px solid #27272a;">Device ID</td>
              <td style="padding: 8px 0; font-family: monospace; color: #ffffff;">${payload.deviceId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; border-b: 1px solid #27272a;">Severity</td>
              <td style="padding: 8px 0; font-weight: bold; color: #ef4444;">${payload.severity || 'HIGH'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Time (UTC)</td>
              <td style="padding: 8px 0; color: #ffffff;">${payload.eventTs ? new Date(payload.eventTs).toUTCString() : 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px; margin-bottom: 15px;">
          <a href="https://emotofleet.com/incidents" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);">Open Incident Desk</a>
        </div>
      </div>
      
      <div style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 12px; color: #71717a; text-align: center; line-height: 1.5;">
        <p>&copy; ${new Date().getFullYear()} eMoto. All rights reserved.</p>
        <p>This is an automated operational notification. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  private buildSosEmailHtml(to: string, payload: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>eMoto SOS Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d0d0e; color: #e4e4e7;">
  <div style="width: 100%; background-color: #0d0d0e; padding: 40px 20px; box-sizing: border-box;">
    <div style="max-width: 580px; margin: 0 auto; background-color: #161617; border: 1px solid #27272a; border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4); box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 22px; font-weight: 800; color: #3b82f6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0;">eMoto</h1>
        <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 5px;">Incident Desk Alert</div>
      </div>
      
      <div style="font-size: 15px; line-height: 1.6; color: #d4d4d8; margin-bottom: 30px;">
        <p>Hello,</p>
        <p>An urgent <strong style="color: #3b82f6;">SOS Signal</strong> has been triggered by a rider in your fleet.</p>
        
        <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 16px; padding: 20px 25px; margin: 25px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; width: 120px; border-b: 1px solid #27272a;">Bike ID</td>
              <td style="padding: 8px 0; font-weight: bold; color: #ffffff;">${payload.bikeId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; border-b: 1px solid #27272a;">Device ID</td>
              <td style="padding: 8px 0; font-family: monospace; color: #ffffff;">${payload.deviceId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; border-b: 1px solid #27272a;">Severity</td>
              <td style="padding: 8px 0; font-weight: bold; color: #3b82f6;">${payload.severity || 'CRITICAL'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Time (UTC)</td>
              <td style="padding: 8px 0; color: #ffffff;">${payload.eventTs ? new Date(payload.eventTs).toUTCString() : 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px; margin-bottom: 15px;">
          <a href="https://emotofleet.com/incidents" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);">Open Incident Desk</a>
        </div>
      </div>
      
      <div style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 12px; color: #71717a; text-align: center; line-height: 1.5;">
        <p>&copy; ${new Date().getFullYear()} eMoto. All rights reserved.</p>
        <p>This is an automated operational notification. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-emoto-signature': signature,
          'x-emoto-timestamp': timestamp,
        },
        body: payloadString,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Webhook delivery failed with status ${response.status}`,
        );
      }
    } finally {
      clearTimeout(timeout);
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
