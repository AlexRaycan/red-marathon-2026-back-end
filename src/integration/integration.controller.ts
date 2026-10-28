import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

import { ErrorResponse } from '../common/response/error-response'
import {
  EXTERNAL_SEARCH_RATE_LIMIT,
  EXTERNAL_SEARCH_RATE_TTL_MS
} from '../constants/integration.constants'

import { ExternalSearchDto } from './dto/external-search.dto'
import { IntegrationService } from './integration.service'
import { ExternalTitleResponse } from './response/external-title-response'
import { GenreResponse } from './response/genre-response'

@ApiTags('external')
@Controller('external')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /** Публичный поиск во внешних API с лимитом запросов на IP */
  @Get('search')
  @ApiOperation({ operationId: 'searchTitles' })
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: EXTERNAL_SEARCH_RATE_LIMIT,
      ttl: EXTERNAL_SEARCH_RATE_TTL_MS
    }
  })
  @ApiOkResponse({ type: [ExternalTitleResponse] })
  @ApiTooManyRequestsResponse({ type: ErrorResponse })
  search(@Query() dto: ExternalSearchDto): Promise<ExternalTitleResponse[]> {
    return this.integrationService.search(dto.q, dto.type, {
      genres: dto.genre,
      yearFrom: dto.yearFrom,
      yearTo: dto.yearTo
    })
  }

  /** Общий список жанров для фильтра: у каждого источника свои названия */
  @Get('genres')
  @ApiOperation({ operationId: 'externalGenres' })
  @ApiOkResponse({ type: [GenreResponse] })
  findGenres(): GenreResponse[] {
    return this.integrationService.getGenres()
  }
}
