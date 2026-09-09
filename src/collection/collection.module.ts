import { Module } from '@nestjs/common'

import { FriendshipModule } from '../friendship/friendship.module'
import { NotificationModule } from '../notification/notification.module'
import { SubscriptionModule } from '../subscription/subscription.module'

import { CollectionController } from './collection.controller'
import { CollectionService } from './collection.service'

@Module({
  imports: [SubscriptionModule, NotificationModule, FriendshipModule],
  controllers: [CollectionController],
  providers: [CollectionService]
})
export class CollectionModule {}
