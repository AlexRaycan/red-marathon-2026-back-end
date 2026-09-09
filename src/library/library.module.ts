import { Module } from '@nestjs/common'

import { SubscriptionModule } from '../subscription/subscription.module'

import { LibraryController } from './library.controller'
import { LibraryService } from './library.service'

@Module({
  imports: [SubscriptionModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService]
})
export class LibraryModule {}
