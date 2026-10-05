import { Module } from '@nestjs/common'

import { IntegrationModule } from '../integration/integration.module'
import { TitleModule } from '../title/title.module'

import { ReviewController } from './review.controller'
import { ReviewService } from './review.service'

@Module({
  imports: [IntegrationModule, TitleModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService]
})
export class ReviewModule {}
