import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'
import {
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

import { Auth } from '../auth/decorators/auth.decorator'
import { ErrorResponse } from '../common/response/error-response'
import {
  EXTERNAL_SEARCH_RATE_LIMIT,
  EXTERNAL_SEARCH_RATE_TTL_MS
} from '../constants/integration.constants'

import { ExternalSearchDto } from './dto/external-search.dto'
import { ImportTitleDto } from './dto/import-title.dto'
import { IntegrationService } from './integration.service'
import {
  ExternalTitleResponse,
  ImportedTitleResponse
} from './response/external-title-response'

@ApiTags('external')
@Controller('external')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /** Публичный поиск во внешних API с лимитом запросов на IP */
  @Get('search')
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
}
