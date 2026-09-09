import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'

import { AI_RATE_LIMIT, AI_RATE_TTL_MS } from '../constants/ai.constants'

import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { OpenRouterService } from './openrouter.service'

@Module({
  imports: [
    ThrottlerModule.forRoot([{ limit: AI_RATE_LIMIT, ttl: AI_RATE_TTL_MS }])
  ],
  controllers: [AiController],
  providers: [AiService, OpenRouterService]
})
export class AiModule {}
