import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { AI_CACHE_MAX_ITEMS } from '../constants/ai.constants'
import { DiscoverModule } from '../discover/discover.module'
import { IntegrationModule } from '../integration/integration.module'
import { SubscriptionModule } from '../subscription/subscription.module'

import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { OpenRouterService } from './openrouter.service'

@Module({
  imports: [
    DiscoverModule,
    IntegrationModule,
    SubscriptionModule,
    CacheModule.register({ max: AI_CACHE_MAX_ITEMS })
  ],
  controllers: [AiController],
  providers: [AiService, OpenRouterService],
  exports: [AiService]
})
export class AiModule {}
