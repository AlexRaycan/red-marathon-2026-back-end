import { Module } from '@nestjs/common'

import { IntegrationModule } from '../integration/integration.module'

import { SearchController, TitleController } from './title.controller'
import { TitleService } from './title.service'

@Module({
  imports: [IntegrationModule],
  controllers: [TitleController, SearchController],
  providers: [TitleService],
  exports: [TitleService]
})
export class TitleModule {}
