import { Module } from '@nestjs/common'

import { NotificationModule } from '../notification/notification.module'

import { FriendshipController } from './friendship.controller'
import { FriendshipService } from './friendship.service'

@Module({
  imports: [NotificationModule],
  controllers: [FriendshipController],
  providers: [FriendshipService],
  exports: [FriendshipService]
})
export class FriendshipModule {}
