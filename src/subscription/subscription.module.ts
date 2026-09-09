import { Module } from '@nestjs/common'

import { AppleProvider } from './providers/apple.provider'
import { GoogleProvider } from './providers/google.provider'
import { SubscriptionController } from './subscription.controller'
import { WebhookController } from './webhook.controller'
import { SubscriptionService } from './subscription.service'

@Module({
  controllers: [SubscriptionController, WebhookController],
  providers: [SubscriptionService, AppleProvider, GoogleProvider],
  exports: [SubscriptionService]
})
export class SubscriptionModule {}
