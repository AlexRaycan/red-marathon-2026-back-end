import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards
} from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ErrorResponse } from '../common/response/error-response'
import { AI_RATE_LIMIT, AI_RATE_TTL_MS } from '../constants/ai.constants'

import { AiService } from './ai.service'
import { PickerDto } from './dto/picker.dto'
import {
  AiSuggestionsResponse,
  AiSummaryResponse
} from './response/ai-response'

/** Лимит здесь жёстче общего: каждый запрос к модели платный */
@ApiTags('ai')
@Controller('ai')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: AI_RATE_LIMIT, ttl: AI_RATE_TTL_MS } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** Рекомендации по вкусовому профилю */
  @Get('recommendations')
  @ApiOperation({ operationId: 'aiRecommendations' })
  @Auth()
  @ApiOkResponse({ type: AiSuggestionsResponse })
  getRecommendations(
    @CurrentUser('id') userId: string
  ): Promise<AiSuggestionsResponse> {
    return this.aiService.getRecommendations(userId)
  }

  /** AI Picker — подбор под настроение. На бесплатном тарифе есть дневной лимит */
  @Post('picker')
  @ApiOperation({ operationId: 'aiPickTitle' })
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AiSuggestionsResponse })
  @ApiTooManyRequestsResponse({ type: ErrorResponse })
  pick(
    @CurrentUser('id') userId: string,
    @Body() dto: PickerDto
  ): Promise<AiSuggestionsResponse> {
    return this.aiService.pick(userId, dto)
  }

  /** Описание без спойлеров для детальной страницы по ключу: `tmdb-movie-603` */
  @Get('summary/:key')
  @ApiOperation({ operationId: 'aiTitleSummary' })
  @Auth()
  @ApiOkResponse({ type: AiSummaryResponse })
  getSummary(@Param('key') key: string): Promise<AiSummaryResponse> {
    return this.aiService.getSpoilerFreeSummary(key)
  }
}
