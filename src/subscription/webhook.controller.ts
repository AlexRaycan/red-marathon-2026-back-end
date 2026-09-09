import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'

import { AppleProvider } from './providers/apple.provider'
import { GoogleProvider } from './providers/google.provider'
import { SubscriptionService } from './subscription.service'

/**
 * Вебхуки сторов. Без них подписка осталась бы активной навсегда:
 * продления, отмены и возвраты происходят вне нашего приложения.
 *
 * Apple: App Store Server Notifications V2 → POST /webhook/apple
 * Google: Real-Time Developer Notifications через Pub/Sub → POST /webhook/google
 *
 * Оба эндпоинта обязаны отвечать 200 даже на непонятное событие,
 * иначе стор будет слать его повторно сутками.
 */
interface IAppleNotification {
  signedPayload?: string
}

interface IAppleNotificationPayload {
  notificationType?: string
  data?: { signedTransactionInfo?: string }
}

interface IGooglePubSubMessage {
  message?: { data?: string }
}

interface IGoogleNotification {
  packageName?: string
  subscriptionNotification?: {
    notificationType?: number
    purchaseToken?: string
  }
}

@ApiExcludeController()
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name)

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly appleProvider: AppleProvider,
    private readonly googleProvider: GoogleProvider
  ) {}

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  async handleApple(@Body() body: IAppleNotification): Promise<boolean> {
    try {
      if (!body.signedPayload) return true

      const payload =
        this.appleProvider.decodeNotification<IAppleNotificationPayload>(
          body.signedPayload
        )

      const transactionInfo = payload?.data?.signedTransactionInfo

      if (!transactionInfo) return true

      const transaction = this.appleProvider.decodeNotification<{
        transactionId?: string
      }>(transactionInfo)

      if (!transaction?.transactionId) return true

      // Перепроверяем через API, а не доверяем телу уведомления
      const purchase = await this.appleProvider.verify(
        transaction.transactionId
      )

      await this.subscriptionService.applyStoreUpdate(purchase)
    } catch (e) {
      this.logger.error('Ошибка обработки вебхука Apple', e)
    }

    return true
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async handleGoogle(@Body() body: IGooglePubSubMessage): Promise<boolean> {
    try {
      if (!body.message?.data) return true

      // Pub/Sub присылает полезную нагрузку в base64
      const notification = JSON.parse(
        Buffer.from(body.message.data, 'base64').toString()
      ) as IGoogleNotification

      const purchaseToken = notification.subscriptionNotification?.purchaseToken

      if (!purchaseToken) return true

      const purchase = await this.googleProvider.verify(purchaseToken)

      await this.subscriptionService.applyStoreUpdate(purchase)
    } catch (e) {
      this.logger.error('Ошибка обработки вебхука Google', e)
    }

    return true
  }
}
