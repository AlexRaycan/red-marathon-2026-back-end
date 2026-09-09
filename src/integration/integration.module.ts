import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

import {
  EXTERNAL_CACHE_MAX_ITEMS,
  EXTERNAL_CACHE_TTL_MS
} from '../constants/integration.constants'
import { LibraryModule } from '../library/library.module'

import { IntegrationController } from './integration.controller'
import { IntegrationService } from './integration.service'
import { GoogleBooksProvider } from './providers/google-books.provider'
import { RawgProvider } from './providers/rawg.provider'
import { ShikimoriProvider } from './providers/shikimori.provider'
import { TmdbProvider } from './providers/tmdb.provider'

@Module({
  imports: [
    LibraryModule,
    CacheModule.register({
      ttl: EXTERNAL_CACHE_TTL_MS,
      max: EXTERNAL_CACHE_MAX_ITEMS
    })
  ],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    TmdbProvider,
    RawgProvider,
    GoogleBooksProvider,
    ShikimoriProvider
  ],
  exports: [IntegrationService]
})
export class IntegrationModule {}
