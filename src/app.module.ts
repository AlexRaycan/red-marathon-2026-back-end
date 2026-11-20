import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AiModule } from './ai/ai.module'
import { AuthModule } from './auth/auth.module'
import { CollectionModule } from './collection/collection.module'
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
