import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { MomoGatewayService } from './services/momo-gateway.service';
import { PrismaService } from '../prisma/prisma.service';

// DTO for the incoming webhook payload from MTN MoMo
interface MomoCallbackPayload {
  financialTransactionId?: string;
  externalId: string;
  amount: string;
  currency: string;
  payer: {
    partyIdType: string;
    partyId: string;
  };
  payerMessage?: string;
  payeeNote?: string;
  status: 'SUCCESSFUL' | 'FAILED';
  reason?: string | null;
}

@ApiTags('MoMo Webhooks')
@Controller('api/momo')
export class MomoWebhookController {
  private readonly logger = new Logger(MomoWebhookController.name);

  constructor(
    private readonly momoGatewayService: MomoGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('callback')
  @Public()                          // Skip JWT auth - MTN sends this
  @Throttle({ default: { limit: 100, ttl: 60000 } })  // Rate limit: 100 req/min
  @HttpCode(HttpStatus.OK)           // Must return 200 OK immediately
  @ApiOperation({ summary: 'MTN MoMo payment callback webhook' })
  async handleCallback(@Body() payload: MomoCallbackPayload) {
    this.logger.log(`MoMo callback received: externalId=${payload.externalId}, status=${payload.status}`);

    try {
      // 1. Find the MomoTransaction by matching the externalId
      //    The externalId format is "INV-{cycleIdPrefix}" but we should find by
      //    looking up transactions that match this externalId
      const transaction = await this.prisma.momoTransaction.findFirst({
        where: {
          externalId: payload.externalId,
          status: 'PENDING',
        },
      });

      if (!transaction) {
        // Could be a duplicate callback or unknown transaction
        this.logger.warn(`No pending MomoTransaction found for externalId: ${payload.externalId}`);
        return { received: true };
      }

      // 2. Validate amount matches
      const payloadAmount = parseInt(payload.amount, 10);
      if (payloadAmount !== transaction.amount) {
        this.logger.warn(
          `Amount mismatch: expected ${transaction.amount}, got ${payloadAmount} for transaction ${transaction.id}`,
        );
        // Still process but log the discrepancy
      }

      // 3. Process based on status
      if (payload.status === 'SUCCESSFUL') {
        await this.momoGatewayService.processSuccessfulPayment(
          transaction,
          payload.financialTransactionId || '',
        );
        this.logger.log(`Payment SUCCESSFUL for transaction ${transaction.id}`);
      } else {
        await this.momoGatewayService.processFailedPayment(
          transaction,
          payload.reason || 'UNKNOWN',
        );
        this.logger.warn(`Payment FAILED for transaction ${transaction.id}: ${payload.reason}`);
      }
    } catch (error) {
      // NEVER throw to MTN - always return 200
      this.logger.error('Error processing MoMo callback:', error);
    }

    // Always return 200 OK to MTN
    return { received: true };
  }
}
