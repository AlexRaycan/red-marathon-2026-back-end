import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { Request } from 'express'
import { isIP } from 'node:net'

import { AiModule } from './ai/ai.module'
import { AuthModule } from './auth/auth.module'
import { CollectionModule } from './collection/collection.module'
import { AI_RATE_LIMIT, AI_RATE_TTL_MS } from './constants/ai.constants'
import { DiscoverModule } from './discover/discover.module'
import { FriendshipModule } from './friendship/friendship.module'
import { HealthModule } from './health/health.module'
import { ImageModule } from './image/image.module'
import { IntegrationModule } from './integration/integration.module'
import { LibraryModule } from './library/library.module'
import { LegalModule } from './legal/legal.module'
import { NotificationModule } from './notification/notification.module'
import { PrismaModule } from './prisma/prisma.module'
import { ReviewModule } from './review/review.module'
import { SubscriptionModule } from './subscription/subscription.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ limit: AI_RATE_LIMIT, ttl: AI_RATE_TTL_MS }],
      getTracker: (request: Request) => {
        const clientIp = request.get('CF-Connecting-IP')
        if (
          process.env.TRUST_CLOUDFLARE_CLIENT_IP === 'true' &&
          clientIp &&
          isIP(clientIp)
        ) {
          return clientIp
        }
        return request.ip ?? request.socket.remoteAddress ?? 'unknown'
      }
    }),
    PrismaModule,
    HealthModule,
    ImageModule,
    LegalModule,
    AuthModule,
    UserModule,
    DiscoverModule,
    LibraryModule,
    CollectionModule,
    FriendshipModule,
    IntegrationModule,
    ReviewModule,
    AiModule,
    NotificationModule,
    SubscriptionModule
  ]
})
export class AppModule {}
