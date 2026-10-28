import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'

import {
  AI_CACHE_MAX_ITEMS,
  AI_RATE_LIMIT,
  AI_RATE_TTL_MS
} from '../constants/ai.constants'
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
    CacheModule.register({ max: AI_CACHE_MAX_ITEMS }),
    ThrottlerModule.forRoot([{ limit: AI_RATE_LIMIT, ttl: AI_RATE_TTL_MS }])
  ],
  controllers: [AiController],
  providers: [AiService, OpenRouterService],
  exports: [AiService]
})
export class AiModule {}
