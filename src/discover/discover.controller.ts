import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ErrorResponse } from '../common/response/error-response'

import { DiscoverService } from './discover.service'
import { DiscoverQueryDto } from './dto/discover-query.dto'
import {
  DiscoverDetailsResponse,
  DiscoverItemResponse,
  DiscoverMyStateResponse
} from './response/discover-response'

/**
 * Витрина открыта без авторизации — веб рендерит её на сервере.
 * Токен нужен только для личного состояния тайтла (`:key/me`)
 */
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

  /** Статус в библиотеке и свой отзыв — одним запросом для детальной страницы */
  @Get(':key/me')
  @Auth()
  @ApiOkResponse({ type: DiscoverMyStateResponse })
  findMyState(
    @CurrentUser('id') userId: string,
    @Param('key') key: string
  ): Promise<DiscoverMyStateResponse> {
    return this.discoverService.findMyState(userId, key)
  }
}
