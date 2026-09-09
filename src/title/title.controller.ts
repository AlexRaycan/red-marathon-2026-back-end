import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { SearchQueryDto } from './dto/search-query.dto'
import { TitleQueryDto } from './dto/title-query.dto'
import {
  TitleListItemResponse,
  TitleListResponse,
  TitleResponse
} from './response/title-response'
import { TitleService } from './title.service'

/** Каталог открыт без авторизации — веб рендерит его на сервере */
@ApiTags('titles')
@Controller('titles')
export class TitleController {
  constructor(private readonly titleService: TitleService) {}

  @Get()
  @ApiOkResponse({ type: TitleListResponse })
  findAll(@Query() query: TitleQueryDto): Promise<TitleListResponse> {
    return this.titleService.findAll(query)
  }

  @Get(':slug')
  @ApiOkResponse({ type: TitleResponse })
  findBySlug(@Param('slug') slug: string): Promise<TitleResponse> {
    return this.titleService.findBySlug(slug)
  }
}

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly titleService: TitleService) {}

  @Get()
  @ApiOkResponse({ type: TitleListResponse })
  search(@Query() query: SearchQueryDto): Promise<TitleListResponse> {
    return this.titleService.search(query)
  }

  /** Подсказки для поисковой строки и браузерного расширения */
  @Get('suggest')
  @ApiOkResponse({ type: [TitleListItemResponse] })
  suggest(@Query('q') q: string): Promise<TitleListItemResponse[]> {
    return this.titleService.suggest(q)
  }
}
