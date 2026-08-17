import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { MomoGatewayService } from './services/momo-gateway.service';
import { PrismaService } from '../prisma/prisma.service';

interface MomoCallbackPayload {
  depositId?: string;
  transactionId?: string;
  financialTransactionId?: string;
  externalId?: string;
  amount?: string | number;
  currency?: string;
  payer?: any;
  payerMessage?: string;
  payeeNote?: string;
  status: string;
  reason?: string | null;
  failureReason?: string | null;
}

@ApiTags('MoMo Webhooks')
@Controller('api/momo')
export class MomoWebhookController {
  private readonly logger = new Logger(MomoWebhookController.name);

  constructor(
    private readonly momoGatewayService: MomoGatewayService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('callback')
  @Public() // Skip JWT auth - PawaPay / MTN sends this
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // Rate limit: 100 req/min
  @HttpCode(HttpStatus.OK) // Must return 200 OK immediately
  @ApiOperation({ summary: 'PawaPay & MTN MoMo payment callback webhook' })
  async handleCallback(@Body() payload: MomoCallbackPayload, @Req() req: any) {
    const webhookSecret = this.configService.get<string>('MOMO_WEBHOOK_SECRET');
    if (webhookSecret) {
      const headerSecret = req.headers['x-webhook-secret'] || req.headers['x-callback-secret'];
      if (headerSecret !== webhookSecret) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }
    const targetId =
      payload.depositId ||
      payload.externalId ||
      payload.transactionId ||
      payload.financialTransactionId;

    this.logger.log(
      `MoMo/PawaPay callback received: targetId=${targetId}, status=${payload.status}`,
    );

    try {
      if (!targetId) {
        this.logger.warn('Callback received without valid targetId/externalId');
        return { received: true };
      }

      const transaction = await this.prisma.momoTransaction.findFirst({
        where: {
          OR: [{ referenceId: targetId }, { externalId: targetId }],
          status: 'PENDING',
        },
      });

      if (!transaction) {
        this.logger.warn(
          `No pending MomoTransaction found for targetId: ${targetId}`,
        );
        return { received: true };
      }

      const isSuccess =
        payload.status === 'COMPLETED' ||
        payload.status === 'SUCCESSFUL' ||
        payload.status === 'SUCCESS';

      if (isSuccess) {
        await this.momoGatewayService.processSuccessfulPayment(
          transaction,
          payload.financialTransactionId || payload.transactionId || targetId,
        );
        this.logger.log(`Payment COMPLETED for transaction ${transaction.id}`);
      } else {
        const failureMsg = payload.reason || payload.failureReason || 'FAILED';
        await this.momoGatewayService.processFailedPayment(
          transaction,
          failureMsg,
        );
        this.logger.warn(
          `Payment FAILED for transaction ${transaction.id}: ${failureMsg}`,
        );
      }
    } catch (error: any) {
      // NEVER throw 500 to payment gateway - always return 200 OK
      this.logger.error('Error processing MoMo callback:', error);
    }

    // Always return 200 OK
    return { received: true };
  }
}
