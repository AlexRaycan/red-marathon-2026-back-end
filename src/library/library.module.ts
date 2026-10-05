import { Module } from '@nestjs/common'

import { IntegrationModule } from '../integration/integration.module'
import { SubscriptionModule } from '../subscription/subscription.module'

import { LibraryController } from './library.controller'
import { LibraryService } from './library.service'

@Module({
  imports: [IntegrationModule, SubscriptionModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService]
})
export class LibraryModule {}
