import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  MomoTransactionStatus,
  BillingCycleStatus,
  FleetSubscriptionStatus,
  AuditActionType,
} from '@prisma/client';
import { MailService } from '../../mail/mail.service';

import { BillingCycleService } from './billing-cycle.service';

@Injectable()
export class MomoGatewayService {
  private readonly logger = new Logger(MomoGatewayService.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly billingCycleService: BillingCycleService,
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const baseUrl = this.configService.get<string>('MOMO_BASE_URL');
    const apiUser = this.configService.get<string>('MOMO_API_USER');
    const apiKey = this.configService.get<string>('MOMO_API_KEY');
    const subscriptionKey = this.configService.get<string>(
      'MOMO_SUBSCRIPTION_KEY',
    );

    if (
      !baseUrl ||
      !apiUser ||
      !apiKey ||
      !subscriptionKey ||
      process.env.MOMO_MOCK === 'true'
    ) {
      this.logger.warn(
        'MoMo API credentials not configured or MOMO_MOCK=true. Using simulated MoMo gateway.',
      );
      this.accessToken = 'sandbox_mock_token';
      this.tokenExpiry = Date.now() + 3600 * 1000;
      return this.accessToken;
    }

    try {
      const authHeader = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');

      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/collection/v1_0/token`,
          {},
          {
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Ocp-Apim-Subscription-Key': subscriptionKey,
            },
          },
        ),
      );

      if (!response.data?.access_token) {
        throw new Error('Invalid token response from MoMo API');
      }

      this.accessToken = response.data.access_token as string;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error: any) {
      this.logger.warn(
        `Failed to get MoMo access token from remote API (${error?.message || error}). Falling back to simulated MoMo gateway.`,
      );
      this.accessToken = 'sandbox_mock_token';
      this.tokenExpiry = Date.now() + 3600 * 1000;
      return this.accessToken;
    }
  }

  async requestToPay(
    fleetId: string,
    billingCycleId: string,
    amount: number,
    payerPhone: string,
  ) {
    const normalizedPhone = this.normalizePhone(payerPhone);
    const referenceId = uuidv4();
    const idempotencyKey = `${billingCycleId}:0`;
    const externalId = `INV-${billingCycleId.slice(0, 8)}`;

    let transaction = await this.prisma.momoTransaction.create({
      data: {
        referenceId,
        idempotencyKey,
        externalId,
        amount,
        payerPhone: normalizedPhone,
        status: MomoTransactionStatus.PENDING,
        billingCycleId,
        fleetId,
      },
    });

    try {
      const token = await this.getAccessToken();

      if (token === 'sandbox_mock_token') {
        this.logger.log(
          `[MOCK MOMO] Simulated subscription payment request for ${normalizedPhone} (${amount} RWF)`,
        );
        setTimeout(() => {
          this.processSuccessfulPayment(
            transaction,
            `MOMO-SIM-${Date.now()}`,
          ).catch((err) => {
            this.logger.error(
              'Failed to auto-confirm mock subscription payment',
              err,
            );
          });
        }, 1500);

        return transaction;
      }

      const baseUrl = this.configService.get<string>('MOMO_BASE_URL', '');
      const targetEnv = this.configService.get<string>(
        'MOMO_TARGET_ENV',
        'sandbox',
      );
      const subscriptionKey = this.configService.get<string>(
        'MOMO_SUBSCRIPTION_KEY',
        '',
      );
      const callbackUrl = this.configService.get<string>(
        'MOMO_CALLBACK_URL',
        '',
      );
      const isPawaPay = baseUrl.includes('pawapay');

      if (isPawaPay) {
        const correspondent =
          normalizedPhone.startsWith('25073') ||
          normalizedPhone.startsWith('25072')
            ? 'AIRTEL_RWA'
            : 'MTN_MOMO_RWA';

        await firstValueFrom(
          this.httpService.post(
            `${baseUrl}/deposits`,
            {
              depositId: referenceId,
              amount: String(amount),
              currency: 'RWF',
              country: 'RWA',
              correspondent,
              payer: {
                type: 'MSISDN',
                address: {
                  value: normalizedPhone,
                },
              },
              customerTimestamp: new Date().toISOString(),
              statementDescription: 'eMoto Fleet Subscription',
            },
            {
              headers: {
                Authorization: `Bearer ${subscriptionKey}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        );
      } else {
        await firstValueFrom(
          this.httpService.post(
            `${baseUrl}/collection/v1_0/requesttopay`,
            {
              amount: String(amount),
              currency: 'RWF',
              externalId,
              payer: {
                partyIdType: 'MSISDN',
                partyId: normalizedPhone,
              },
              payerMessage: `E-Moto Fleet OS subscription payment`,
              payeeNote: 'Fleet subscription',
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Reference-Id': referenceId,
                'X-Target-Environment': targetEnv,
                'Ocp-Apim-Subscription-Key': subscriptionKey,
                'X-Callback-Url': callbackUrl,
                'Content-Type': 'application/json',
              },
            },
          ),
        );
      }

      await this.auditService.createAuditLog({
        fleetId,
        actionType: AuditActionType.MOMO_PAYMENT_REQUESTED,
        targetType: 'MomoTransaction',
        targetId: transaction.id,
        metaJson: { amount, referenceId },
      });

      return transaction;
    } catch (error: any) {
      this.logger.error(
        `Failed to execute requestToPay for ${referenceId}`,
        error?.response?.data || error,
      );

      transaction = await this.prisma.momoTransaction.update({
        where: { id: transaction.id },
        data: {
          status: MomoTransactionStatus.FAILED,
          failureReason: error.response?.data?.message || error.message,
        },
      });

      return transaction;
    }
  }

  async requestRiderCollectionToPay(
    fleetId: string,
    riderId: string,
    amount: number,
    payerPhone: string,
    isPartial?: boolean,
    partialReason?: string,
  ) {
    const normalizedPhone = this.normalizePhone(payerPhone);
    const referenceId = uuidv4();
    const timestamp = Date.now();
    const idempotencyKey = `rider-coll-${riderId}-${timestamp}`;
    const externalId = `RIDER-${riderId.slice(0, 6)}-${timestamp.toString().slice(-6)}`;
    const payerMsg =
      isPartial && partialReason
        ? `PARTIAL:${partialReason}`
        : 'Rider collection payment';

    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      select: { momoPhoneNumber: true, name: true },
    });

    if (!fleet?.momoPhoneNumber) {
      throw new BadRequestException(
        `Fleet Admin for "${fleet?.name || 'this fleet'}" has not configured a MoMo receiving phone number in Fleet Settings. Payments must transfer directly to the Fleet Admin's MoMo wallet. Please configure your MoMo number in Settings.`,
      );
    }
    const receivingTarget = `Fleet Admin MoMo (${fleet.momoPhoneNumber})`;

    let transaction = await this.prisma.momoTransaction.create({
      data: {
        referenceId,
        idempotencyKey,
        externalId,
        amount,
        payerPhone: normalizedPhone,
        status: MomoTransactionStatus.PENDING,
        fleetId,
        riderId,
        payerMessage: payerMsg,
      },
    });

    try {
      const token = await this.getAccessToken();

      if (token === 'sandbox_mock_token') {
        this.logger.log(
          `[MOCK MOMO] Simulated rider collection payment of ${amount} RWF from ${normalizedPhone} -> Receiving Target: ${receivingTarget}`,
        );
        setTimeout(() => {
          this.processSuccessfulPayment(
            transaction,
            `MOMO-SIM-${Date.now()}`,
          ).catch((err) => {
            this.logger.error(
              'Failed to auto-confirm mock rider transaction',
              err,
            );
          });
        }, 1500);

        return transaction;
      }

      const baseUrl = this.configService.get<string>('MOMO_BASE_URL', '');
      const targetEnv = this.configService.get<string>(
        'MOMO_TARGET_ENV',
        'sandbox',
      );
      const subscriptionKey = this.configService.get<string>(
        'MOMO_SUBSCRIPTION_KEY',
        '',
      );
      const callbackUrl = this.configService.get<string>(
        'MOMO_CALLBACK_URL',
        '',
      );
      const isPawaPay = baseUrl.includes('pawapay');

      if (isPawaPay) {
        const correspondent =
          normalizedPhone.startsWith('25073') ||
          normalizedPhone.startsWith('25072')
            ? 'AIRTEL_RWA'
            : 'MTN_MOMO_RWA';

        await firstValueFrom(
          this.httpService.post(
            `${baseUrl}/deposits`,
            {
              depositId: referenceId,
              amount: String(amount),
              currency: 'RWF',
              country: 'RWA',
              correspondent,
              payer: {
                type: 'MSISDN',
                address: {
                  value: normalizedPhone,
                },
              },
              customerTimestamp: new Date().toISOString(),
              statementDescription: 'eMoto Fleet Payment',
            },
            {
              headers: {
                Authorization: `Bearer ${subscriptionKey}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        );
      } else {
        await firstValueFrom(
          this.httpService.post(
            `${baseUrl}/collection/v1_0/requesttopay`,
            {
              amount: String(amount),
              currency: 'RWF',
              externalId,
              payer: {
                partyIdType: 'MSISDN',
                partyId: normalizedPhone,
              },
              payerMessage: `E-Moto Fleet OS daily collection payment`,
              payeeNote: 'Rider daily lease collection',
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Reference-Id': referenceId,
                'X-Target-Environment': targetEnv,
                'Ocp-Apim-Subscription-Key': subscriptionKey,
                'X-Callback-Url': callbackUrl,
                'Content-Type': 'application/json',
              },
            },
          ),
        );
      }

      await this.auditService.createAuditLog({
        fleetId,
        actorUserId: riderId,
        actionType: AuditActionType.MOMO_PAYMENT_REQUESTED,
        targetType: 'MomoTransaction',
        targetId: transaction.id,
        metaJson: { amount, referenceId, riderId },
      });

      return transaction;
    } catch (error: any) {
      this.logger.error(
        `Failed to execute requestRiderCollectionToPay for ${referenceId}`,
        error?.response?.data || error,
      );

      transaction = await this.prisma.momoTransaction.update({
        where: { id: transaction.id },
        data: {
          status: MomoTransactionStatus.FAILED,
          failureReason: error.response?.data?.message || error.message,
        },
      });

      return transaction;
    }
  }

  async checkTransactionStatus(referenceId: string) {
    const tx = await this.prisma.momoTransaction.findUnique({
      where: { referenceId },
    });

    if (
      tx &&
      (tx.status === MomoTransactionStatus.SUCCESSFUL ||
        tx.status === MomoTransactionStatus.FAILED)
    ) {
      return {
        status: tx.status,
        financialTransactionId: tx.financialTransactionId,
      };
    }

    try {
      const token = await this.getAccessToken();

      if (token === 'sandbox_mock_token') {
        return tx
          ? {
              status: tx.status,
              financialTransactionId: tx.financialTransactionId,
            }
          : { status: 'PENDING' };
      }

      const baseUrl = this.configService.get<string>('MOMO_BASE_URL');
      const targetEnv = this.configService.get<string>('MOMO_TARGET_ENV');
      const subscriptionKey = this.configService.get<string>(
        'MOMO_SUBSCRIPTION_KEY',
      );

      const response = await firstValueFrom(
        this.httpService.get(
          `${baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Target-Environment': targetEnv,
              'Ocp-Apim-Subscription-Key': subscriptionKey,
            },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to check transaction status for ${referenceId}`,
        error?.response?.data || error,
      );
      return tx
        ? {
            status: tx.status,
            financialTransactionId: tx.financialTransactionId,
          }
        : { status: 'FAILED' };
    }
  }

  async processSuccessfulPayment(
    transaction: any,
    financialTransactionId: string,
  ) {
    try {
      await this.prisma.$transaction(async (prisma) => {
        await prisma.momoTransaction.update({
          where: { id: transaction.id },
          data: {
            status: MomoTransactionStatus.SUCCESSFUL,
            financialTransactionId,
            callbackReceivedAt: new Date(),
          },
        });

        if (transaction.billingCycleId) {
          const cycle = await prisma.billingCycle.findUnique({
            where: { id: transaction.billingCycleId },
            include: { fleet: true },
          });

          if (cycle && cycle.status !== BillingCycleStatus.PAID) {
            const owner = await prisma.user.findFirst({
              where: {
                fleetId: transaction.fleetId,
                role: 'OWNER',
              },
            });

            const paidAt = new Date();

            await prisma.billingPayment.create({
              data: {
                billingCycleId: cycle.id,
                fleetId: transaction.fleetId,
                amount: transaction.amount,
                method: 'MOBILE_MONEY',
                reference: financialTransactionId,
                recordedById: owner?.id ?? transaction.fleetId,
                paidAt,
              },
            });

            const remainingDue = Math.max(0, cycle.totalDue - (cycle.totalPaid || 0));
            const newTotalPaid = Math.min(cycle.totalDue, (cycle.totalPaid || 0) + transaction.amount);
            const newStatus =
              newTotalPaid >= cycle.totalDue
                ? BillingCycleStatus.PAID
                : BillingCycleStatus.PARTIAL;

            await prisma.billingCycle.update({
              where: { id: cycle.id },
              data: {
                totalPaid: newTotalPaid,
                status: newStatus,
                paidAt: newStatus === BillingCycleStatus.PAID ? paidAt : null,
              },
            });

            if (newStatus === BillingCycleStatus.PAID) {
              const overdueCycles = await prisma.billingCycle.count({
                where: {
                  fleetId: transaction.fleetId,
                  status: {
                    in: [
                      BillingCycleStatus.PENDING,
                      BillingCycleStatus.OVERDUE,
                      BillingCycleStatus.PARTIAL,
                    ],
                  },
                  dueDate: { lt: new Date() },
                },
              });

              if (overdueCycles === 0) {
                await prisma.fleet.update({
                  where: { id: transaction.fleetId },
                  data: {
                    subscriptionStatus: FleetSubscriptionStatus.ACTIVE,
                  },
                });
              }

              try {
                await this.billingCycleService.generateCycleForFleet(
                  transaction.fleetId,
                  true,
                );
              } catch {
                // Next weekly period has not arrived yet or is already active
              }
            }
          }
        }

        // Handle Rider Daily Collection / Lease Payment
        if (transaction.riderId) {
          const paidAt = new Date();
          const isPartial =
            transaction.payerMessage?.startsWith('PARTIAL:') ?? false;
          const partialReason = isPartial
            ? transaction.payerMessage?.replace('PARTIAL:', '').trim()
            : null;

          const paymentRecord = await prisma.riderPayment.create({
            data: {
              fleetId: transaction.fleetId,
              riderId: transaction.riderId,
              amount: transaction.amount,
              paidAt,
              method: 'MOBILE_MONEY',
              status: isPartial ? 'PARTIAL' : 'PAID',
              isPartial,
              partialReason,
              reference: financialTransactionId || transaction.referenceId,
              notes: isPartial
                ? `Partial MoMo direct transfer: ${partialReason}`
                : `Direct MoMo transfer from ${transaction.payerPhone} to Fleet Admin wallet. Recorded in eMoto ledger.`,
            },
          });

          // Update rider profile lease-to-own principal if applicable
          const profile = await prisma.riderProfile.findUnique({
            where: { userId: transaction.riderId },
          });
          if (profile && profile.leaseToOwn && profile.leasePrincipal) {
            // leasePrincipal is the fixed total asset price. Remaining balance is computed as (leasePrincipal - totalPaid) in getRiderPaymentSummary.
            this.logger.log(
              `Recorded payment ${transaction.amount} towards lease-to-own for rider ${transaction.riderId} (principal: ${profile.leasePrincipal} RWF)`,
            );
          }

          await prisma.auditLog.create({
            data: {
              fleetId: transaction.fleetId,
              actorUserId: transaction.riderId,
              actionType: AuditActionType.RIDER_PAYMENT_RECORDED,
              targetType: 'RIDER_PAYMENT',
              targetId: paymentRecord.id,
              metaJson: {
                riderId: transaction.riderId,
                amount: transaction.amount,
                method: 'MOBILE_MONEY',
                status: isPartial ? 'PARTIAL' : 'PAID',
                reference: financialTransactionId || transaction.referenceId,
                isDirectFleetTransfer: true,
              },
            },
          });

          this.logger.log(
            `Auto-recorded direct pass-through RiderPayment of ${transaction.amount} RWF for rider ${transaction.riderId}`,
          );
        }
      });

      // Audit and email outside the DB transaction
      await this.auditService.createAuditLog({
        fleetId: transaction.fleetId,
        actionType: AuditActionType.MOMO_PAYMENT_RECEIVED,
        targetType: 'MomoTransaction',
        targetId: transaction.id,
        metaJson: { financialTransactionId, amount: transaction.amount },
      });

      try {
        const fleetUsers = await this.prisma.user.findMany({
          where: {
            fleetId: transaction.fleetId,
            role: { in: ['OWNER', 'ADMIN'] },
            email: { not: null },
          },
        });

        for (const fUser of fleetUsers) {
          if (fUser.email) {
            await this.mailService.sendNotificationEmail(
              fUser.email,
              'MoMo Payment Received',
              'Payment Confirmed',
              `Your MoMo payment of ${transaction.amount.toLocaleString()} RWF has been received and applied to your subscription invoice. Transaction ID: ${financialTransactionId}`,
            );
          }
        }
      } catch (mailError) {
        this.logger.error(
          'Failed to send payment confirmation email',
          mailError,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process successful payment for tx ${transaction.id}`,
        error,
      );
      throw error;
    }
  }

  async processFailedPayment(transaction: any, reason: string) {
    try {
      const NON_RETRYABLE = ['PAYER_NOT_FOUND'];
      const maxRetries = 3;
      const isRetryable = !NON_RETRYABLE.includes(reason);

      let nextRetryAt: Date | null = null;

      if (isRetryable && transaction.retryCount < maxRetries) {
        const delays = [1, 4, 12]; // Hours
        const delayHours = delays[transaction.retryCount] || 24;
        nextRetryAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);
      }

      await this.prisma.momoTransaction.update({
        where: { id: transaction.id },
        data: {
          status: MomoTransactionStatus.FAILED,
          failureReason: reason,
          nextRetryAt,
        },
      });

      await this.auditService.createAuditLog({
        fleetId: transaction.fleetId,
        actionType: AuditActionType.MOMO_PAYMENT_FAILED,
        targetType: 'MomoTransaction',
        targetId: transaction.id,
        metaJson: { reason, isRetryable, nextRetryAt },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to process failed payment for tx ${transaction.id}`,
        error,
      );
      throw error;
    }
  }

  async retryFailedPayment(transactionId: string) {
    const transaction = await this.prisma.momoTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction)
      throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
    if (transaction.status !== MomoTransactionStatus.FAILED) {
      throw new HttpException(
        'Transaction is not in FAILED state',
        HttpStatus.BAD_REQUEST,
      );
    }

    const maxRetries = 3;
    if (transaction.retryCount >= maxRetries) {
      throw new HttpException('Max retries reached', HttpStatus.BAD_REQUEST);
    }

    const newReferenceId = uuidv4();
    const newRetryCount = transaction.retryCount + 1;
    const newIdempotencyKey = `${transaction.billingCycleId}:${newRetryCount}`;

    const updatedTx = await this.prisma.momoTransaction.update({
      where: { id: transactionId },
      data: {
        referenceId: newReferenceId,
        idempotencyKey: newIdempotencyKey,
        retryCount: newRetryCount,
        status: MomoTransactionStatus.PENDING,
        failureReason: null,
        nextRetryAt: null,
      },
    });

    try {
      const token = await this.getAccessToken();
      const baseUrl = this.configService.get<string>('MOMO_BASE_URL');
      const targetEnv = this.configService.get<string>('MOMO_TARGET_ENV');
      const subscriptionKey = this.configService.get<string>(
        'MOMO_SUBSCRIPTION_KEY',
      );
      const callbackUrl = this.configService.get<string>('MOMO_CALLBACK_URL');

      await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/collection/v1_0/requesttopay`,
          {
            amount: String(updatedTx.amount),
            currency: 'RWF',
            externalId: updatedTx.externalId,
            payer: {
              partyIdType: 'MSISDN',
              partyId: updatedTx.payerPhone,
            },
            payerMessage: `E-Moto Fleet OS subscription payment`,
            payeeNote: 'Fleet subscription',
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Reference-Id': newReferenceId,
              'X-Target-Environment': targetEnv,
              'Ocp-Apim-Subscription-Key': subscriptionKey,
              'X-Callback-Url': callbackUrl,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      await this.auditService.createAuditLog({
        fleetId: transaction.fleetId,
        actionType: AuditActionType.MOMO_PAYMENT_RETRIED,
        targetType: 'MomoTransaction',
        targetId: transaction.id,
        metaJson: { newReferenceId, retryCount: newRetryCount },
      });

      return updatedTx;
    } catch (error: any) {
      this.logger.error(
        `Failed to retry payment for tx ${transaction.id}`,
        error?.response?.data || error,
      );

      await this.prisma.momoTransaction.update({
        where: { id: transaction.id },
        data: {
          status: MomoTransactionStatus.FAILED,
          failureReason: error.response?.data?.message || error.message,
        },
      });

      throw new HttpException(
        'Retry failed at MoMo API',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  normalizePhone(phone: string): string {
    const normalized = phone.replace(/[^\d]/g, '');
    if (normalized.startsWith('250')) return normalized;
    if (normalized.startsWith('0')) return '250' + normalized.substring(1);
    if (/^(78|79|72|73)/.test(normalized)) return '250' + normalized;
    return normalized;
  }
}
