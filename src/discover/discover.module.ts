import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

import {
  EXTERNAL_CACHE_MAX_ITEMS,
  TRENDING_CACHE_TTL_MS
} from '../constants/integration.constants'
import { IntegrationModule } from '../integration/integration.module'
import { ReviewModule } from '../review/review.module'

import { DiscoverController } from './discover.controller'
import { DiscoverService } from './discover.service'

@Module({
  imports: [
    IntegrationModule,
    ReviewModule,
    CacheModule.register({
      ttl: TRENDING_CACHE_TTL_MS,
      max: EXTERNAL_CACHE_MAX_ITEMS
    })
  ],
  controllers: [DiscoverController],
  providers: [DiscoverService]
})
export class DiscoverModule {}
