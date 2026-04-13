import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PartnerAuthService } from './partner-auth.service';
import type { PartnerTokenResponse } from './partner.types';

@ApiTags('partner')
@Public()
@Controller('partner/oauth')
export class PartnerAuthController {
  constructor(private readonly partnerAuthService: PartnerAuthService) {}

  @Post('token')
  @HttpCode(200)
  @Throttle({
    default: { limit: 5, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Issue insurer partner token with OAuth2 client-credentials flow',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clientId', 'clientSecret'],
      properties: {
        clientId: {
          type: 'string',
          example: 'partner-demo-client',
        },
        clientSecret: {
          type: 'string',
          example: 'PartnerSecret123!',
        },
      },
    },
  })
  async issueToken(@Body() body: unknown): Promise<PartnerTokenResponse> {
    return this.partnerAuthService.issueTokenFromClientCredentials(body);
  }
}
