import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SendSmsResult {
  success: boolean;
  provider: string;
  messageId?: string;
  cost?: string;
  error?: string;
}

interface AfricasTalkingRecipient {
  statusCode?: number;
  number?: string;
  status?: string;
  cost?: string;
  messageId?: string;
}

interface AfricasTalkingResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AfricasTalkingRecipient[];
  };
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly enabled: boolean;
  private readonly provider: 'africastalking' | 'log';

  private cleanStr(val: string | undefined): string | undefined {
    if (!val) return undefined;
    const cleaned = val.replace(/^["']|["']$/g, '').trim();
    return cleaned.length > 0 ? cleaned : undefined;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.enabled = this.configService.get<boolean>(
      'SMS_FALLBACK_ENABLED',
      true,
    );
    const rawProvider = this.cleanStr(
      this.configService.get<string>('SMS_PROVIDER', 'africastalking'),
    );
    this.provider =
      rawProvider && rawProvider.toLowerCase().includes('log')
        ? 'log'
        : 'africastalking';
  }

  /**
   * Normalizes Rwandan and East African phone numbers into E.164 format (+25078XXXXXXX).
   */
  public normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s()+-]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '250' + cleaned.substring(1);
    } else if (
      cleaned.length === 9 &&
      (cleaned.startsWith('7') || cleaned.startsWith('8'))
    ) {
      cleaned = '250' + cleaned;
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  /**
   * Dispatches an SMS command to a device tracker SIM phone using Africa's Talking.
   * Primary use case: Command Center remote LOCK (9400000) and UNLOCK (9410000).
   */
  public async sendSms(to: string, message: string): Promise<SendSmsResult> {
    if (!this.enabled) {
      this.logger.debug(
        `SMS dispatch disabled by configuration. Target: ${to}, Message: "${message}"`,
      );
      return {
        success: false,
        provider: 'disabled',
        error: 'SMS dispatch disabled by configuration',
      };
    }

    const recipient = this.normalizePhone(to);

    if (this.provider === 'log') {
      this.logger.log(
        `[SMS DEV LOG] Dispatched to: ${recipient} | Command: "${message}"`,
      );
      return {
        success: true,
        provider: 'log',
        messageId: `log-${Date.now()}`,
      };
    }

    return this.sendViaAfricasTalking(recipient, message);
  }

  /**
   * Africa's Talking SMS Integration.
   * Rates: ~10 RWF ($0.007 USD) per SMS in Rwanda.
   * Endpoints:
   *   - Live: https://api.africastalking.com/version1/messaging
   *   - Sandbox: https://api.sandbox.africastalking.com/version1/messaging
   */
  private async sendViaAfricasTalking(
    to: string,
    message: string,
  ): Promise<SendSmsResult> {
    const username =
      this.cleanStr(
        this.configService.get<string>('AFRICASTALKING_USERNAME'),
      ) || 'sandbox';
    const apiKey = this.cleanStr(
      this.configService.get<string>('AFRICASTALKING_API_KEY'),
    );
    const senderId = this.cleanStr(
      this.configService.get<string>('AFRICASTALKING_SENDER_ID'),
    );

    if (!apiKey) {
      this.logger.warn(
        'AFRICASTALKING_API_KEY is not configured in environment. Emulating SMS via logger.',
      );
      this.logger.log(
        `[AFRICASTALKING LOG EMULATION] To: ${to} | Command: "${message}"`,
      );
      return {
        success: true,
        provider: 'africastalking-log-emulation',
        messageId: `at-mock-${Date.now()}`,
      };
    }

    const isSandbox = username.toLowerCase() === 'sandbox';
    const baseUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', to);
    params.append('message', message);
    if (senderId) {
      params.append('from', senderId);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<AfricasTalkingResponse>(
          baseUrl,
          params.toString(),
          {
            headers: {
              apiKey,
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      const data = response.data;
      const recipientData = data?.SMSMessageData?.Recipients?.[0];

      // Status code 101 represents 'Success' in Africa's Talking API
      if (
        recipientData &&
        (recipientData.status === 'Success' ||
          recipientData.statusCode === 101)
      ) {
        this.logger.log(
          `Successfully dispatched SMS via Africa's Talking to ${to} (Message: "${message}", Cost: ${recipientData.cost || 'N/A'}, ID: ${recipientData.messageId || 'N/A'})`,
        );
        return {
          success: true,
          provider: 'africastalking',
          messageId: recipientData.messageId,
          cost: recipientData.cost,
        };
      }

      const status = recipientData?.status || JSON.stringify(data);
      this.logger.warn(
        `Africa's Talking returned non-success status for ${to}: ${status}`,
      );
      return {
        success: false,
        provider: 'africastalking',
        error: status,
      };
    } catch (err: unknown) {
      const errorMsg = this.extractErrorMessage(err);
      this.logger.error(
        `Failed to dispatch SMS via Africa's Talking to ${to}: ${errorMsg}`,
      );
      return {
        success: false,
        provider: 'africastalking',
        error: errorMsg,
      };
    }
  }

  private extractErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { data?: { message?: string } } })
        .response;
      if (res?.data?.message) {
        return res.data.message;
      }
    }
    return err instanceof Error ? err.message : String(err);
  }
}
