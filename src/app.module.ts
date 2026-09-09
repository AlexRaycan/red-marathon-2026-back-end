import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AiModule } from './ai/ai.module'
import { AuthModule } from './auth/auth.module'
import { CollectionModule } from './collection/collection.module'
import { FriendshipModule } from './friendship/friendship.module'
import { IntegrationModule } from './integration/integration.module'
import { LibraryModule } from './library/library.module'
import { NotificationModule } from './notification/notification.module'
import { PrismaModule } from './prisma/prisma.module'
import { ReviewModule } from './review/review.module'
import { SubscriptionModule } from './subscription/subscription.module'
import { TitleModule } from './title/title.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    TitleModule,
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
