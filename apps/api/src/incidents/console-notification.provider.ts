import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider } from './notification-provider';
import { NotificationDispatchInput } from './incidents.types';

@Injectable()
export class ConsoleNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(ConsoleNotificationProvider.name);

  // Sends notification payloads to the console for local development.
  send(input: NotificationDispatchInput): Promise<void> {
    this.logger.log(
      `Notification sent type=${input.type} channel=${input.channel} to=${this.maskRecipient(input.to)}`,
    );
    return Promise.resolve();
  }

  // Masks recipient addresses to avoid leaking PII in application logs.
  private maskRecipient(recipient: string): string {
    const trimmed = recipient.trim();
    if (trimmed.length <= 4) {
      return '***';
    }

    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
}
