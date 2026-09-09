import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query
} from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { LibraryEntryResponse } from '../library/response/library-response'

import { ExternalSearchDto } from './dto/external-search.dto'
import { ImportTitleDto } from './dto/import-title.dto'
import { QuickAddDto } from './dto/quick-add.dto'
import { IntegrationService } from './integration.service'
import {
  ExternalTitleResponse,
  ImportedTitleResponse
} from './response/external-title-response'

@ApiTags('external')
@Controller('external')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /** Поиск во внешних API — то, чего ещё нет в нашей базе */
  @Get('search')
  @Auth()
  @ApiOkResponse({ type: [ExternalTitleResponse] })
  search(@Query() dto: ExternalSearchDto): Promise<ExternalTitleResponse[]> {
    return this.integrationService.search(dto.q, dto.type)
  }

  /** Сохранить внешний тайтл к нам */
  @Post('import')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportedTitleResponse })
  import(@Body() dto: ImportTitleDto): Promise<ImportedTitleResponse> {
    return this.integrationService.importTitle(
      dto.source,
      dto.externalId,
      dto.type
    )
  }

  /** Добавление в один клик из расширения: импорт + библиотека */
  @Post('quick-add')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LibraryEntryResponse })
  quickAdd(
    @CurrentUser('id') userId: string,
    @Body() dto: QuickAddDto
  ): Promise<LibraryEntryResponse> {
    return this.integrationService.quickAdd(userId, dto)
  }
}
