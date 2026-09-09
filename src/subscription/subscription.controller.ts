import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post
} from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { VerifyPurchaseDto } from './dto/verify-purchase.dto'
import { SubscriptionResponse } from './response/subscription-response'
import { SubscriptionService } from './subscription.service'

@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /** Тариф, лимиты и текущее потребление */
  @Get()
  @Auth()
  @ApiOkResponse({ type: SubscriptionResponse })
  findMy(@CurrentUser('id') userId: string): Promise<SubscriptionResponse> {
    return this.subscriptionService.findMy(userId)
  }

  /**
   * Подтверждение покупки из мобильного приложения.
   * Веб и расширение сюда не ходят: оплата только в сторах
   */
  @Post('verify')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SubscriptionResponse })
  verifyPurchase(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPurchaseDto
  ): Promise<SubscriptionResponse> {
    return this.subscriptionService.verifyPurchase(userId, dto)
  }

  @Post('trial')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SubscriptionResponse })
  startTrial(@CurrentUser('id') userId: string): Promise<SubscriptionResponse> {
    return this.subscriptionService.startTrial(userId)
  }

  @Post('cancel')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SubscriptionResponse })
  cancel(@CurrentUser('id') userId: string): Promise<SubscriptionResponse> {
    return this.subscriptionService.cancel(userId)
  }
}
