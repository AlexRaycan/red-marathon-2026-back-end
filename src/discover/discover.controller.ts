import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { ErrorResponse } from '../common/response/error-response'

import { DiscoverService } from './discover.service'
import { DiscoverQueryDto } from './dto/discover-query.dto'
import {
  DiscoverDetailsResponse,
  DiscoverItemResponse
} from './response/discover-response'

/** Витрина открыта без авторизации — веб рендерит её на сервере */
@ApiTags('discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discoverService: DiscoverService) {}

  /** Верхний блок главной: фильмы, сериалы, игры, аниме и книги вперемешку */
  @Get('trending')
  @ApiOkResponse({ type: [DiscoverItemResponse] })
  getTrending(
    @Query() query: DiscoverQueryDto
  ): Promise<DiscoverItemResponse[]> {
    return this.discoverService.getTrending(query.take)
  }

  /** Детальная страница по ключу из карточки: `tmdb-movie-603` */
  @Get(':key')
  @ApiOkResponse({ type: DiscoverDetailsResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  findByKey(@Param('key') key: string): Promise<DiscoverDetailsResponse> {
    return this.discoverService.findByKey(key)
  }
}
