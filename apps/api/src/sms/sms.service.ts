import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SendSmsResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

interface AfricasTalkingResponse {
  SMSMessageData?: {
    Recipients?: Array<{
      status?: string;
      statusCode?: number;
      messageId?: string;
    }>;
  };
}

interface TwilioResponse {
  sid?: string;
}

interface GenericSmsResponse {
  messageId?: string;
  id?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly enabled: boolean;
  private readonly provider: 'africastalking' | 'twilio' | 'generic' | 'log';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.enabled = this.configService.get<boolean>(
      'SMS_FALLBACK_ENABLED',
      true,
    );
    this.provider = this.configService.get<
      'africastalking' | 'twilio' | 'generic' | 'log'
    >('SMS_PROVIDER', 'log');
  }

  /**
   * Normalizes Rwandan / East African phone numbers into E.164 format (e.g. 0781234567 -> +250781234567).
   */
  public normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s()+-]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '250' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  /**
   * Dispatches an SMS message using the configured budget-friendly provider.
   */
  public async sendSms(to: string, message: string): Promise<SendSmsResult> {
    if (!this.enabled) {
      this.logger.debug(
        `SMS dispatch disabled by configuration. Message to ${to}: "${message}"`,
      );
      return {
        success: false,
        provider: 'disabled',
        error: 'SMS fallback disabled by config',
      };
    }

    const recipient = this.normalizePhone(to);

    switch (this.provider) {
      case 'africastalking':
        return this.sendViaAfricasTalking(recipient, message);
      case 'twilio':
        return this.sendViaTwilio(recipient, message);
      case 'generic':
        return this.sendViaGenericWebhook(recipient, message);
      case 'log':
      default:
        this.logger.log(
          `[SMS FALLBACK LOG] To: ${recipient} | Message: "${message}"`,
        );
        return {
          success: true,
          provider: 'log',
          messageId: `log-${Date.now()}`,
        };
    }
  }

  /**
   * Africa's Talking SMS Integration (~10 RWF / $0.007 USD per SMS in Rwanda & East Africa).
   */
  private async sendViaAfricasTalking(
    to: string,
    message: string,
  ): Promise<SendSmsResult> {
    const username = this.configService.get<string>(
      'AFRICASTALKING_USERNAME',
      'sandbox',
    );
    const apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY');
    const senderId = this.configService.get<string>('AFRICASTALKING_SENDER_ID');

    if (!apiKey) {
      this.logger.warn(
        'AFRICASTALKING_API_KEY is not configured. Falling back to log.',
      );
      this.logger.log(`[SMS FALLBACK LOG] To: ${to} | Message: "${message}"`);
      return {
        success: true,
        provider: 'log-fallback',
        messageId: `log-${Date.now()}`,
      };
    }

    const baseUrl =
      username === 'sandbox'
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
      if (
        recipientData &&
        (recipientData.status === 'Success' || recipientData.statusCode === 101)
      ) {
        this.logger.log(`Sent SMS via Africa's Talking to ${to}: ${message}`);
        return {
          success: true,
          provider: 'africastalking',
          messageId: recipientData.messageId,
        };
      }

      const status = recipientData?.status || JSON.stringify(data);
      this.logger.warn(`Africa's Talking SMS warning for ${to}: ${status}`);
      return { success: false, provider: 'africastalking', error: status };
    } catch (err: unknown) {
      const errorMsg = this.extractErrorMessage(err);
      this.logger.error(
        `Failed to send SMS via Africa's Talking to ${to}: ${errorMsg}`,
      );
      return { success: false, provider: 'africastalking', error: errorMsg };
    }
  }

  /**
   * Twilio SMS Integration.
   */
  private async sendViaTwilio(
    to: string,
    message: string,
  ): Promise<SendSmsResult> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn(
        'Twilio credentials not configured. Falling back to log.',
      );
      this.logger.log(`[SMS FALLBACK LOG] To: ${to} | Message: "${message}"`);
      return {
        success: true,
        provider: 'log-fallback',
        messageId: `log-${Date.now()}`,
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', fromNumber);
    params.append('Body', message);

    try {
      const response = await firstValueFrom(
        this.httpService.post<TwilioResponse>(url, params.toString(), {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      this.logger.log(`Sent SMS via Twilio to ${to}: ${message}`);
      return {
        success: true,
        provider: 'twilio',
        messageId: response.data?.sid,
      };
    } catch (err: unknown) {
      const errorMsg = this.extractErrorMessage(err);
      this.logger.error(`Failed to send SMS via Twilio to ${to}: ${errorMsg}`);
      return { success: false, provider: 'twilio', error: errorMsg };
    }
  }

  /**
   * Generic Webhook / Local Android Phone SMS Gateway ($0 / Free local SIM SMS bundle).
   */
  private async sendViaGenericWebhook(
    to: string,
    message: string,
  ): Promise<SendSmsResult> {
    const webhookUrl = this.configService.get<string>(
      'GENERIC_SMS_WEBHOOK_URL',
    );
    const webhookToken = this.configService.get<string>(
      'GENERIC_SMS_WEBHOOK_TOKEN',
    );

    if (!webhookUrl) {
      this.logger.warn(
        'Generic SMS Webhook URL not configured. Falling back to log.',
      );
      this.logger.log(`[SMS FALLBACK LOG] To: ${to} | Message: "${message}"`);
      return {
        success: true,
        provider: 'log-fallback',
        messageId: `log-${Date.now()}`,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (webhookToken) {
      headers['Authorization'] = `Bearer ${webhookToken}`;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<GenericSmsResponse>(
          webhookUrl,
          {
            to,
            message,
          },
          { headers },
        ),
      );

      this.logger.log(
        `Dispatched SMS via generic webhook/Android gateway to ${to}: ${message}`,
      );
      return {
        success: true,
        provider: 'generic',
        messageId:
          response.data?.messageId ||
          response.data?.id ||
          `generic-${Date.now()}`,
      };
    } catch (err: unknown) {
      const errorMsg = this.extractErrorMessage(err);
      this.logger.error(
        `Failed to dispatch SMS via generic webhook to ${to}: ${errorMsg}`,
      );
      return { success: false, provider: 'generic', error: errorMsg };
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
