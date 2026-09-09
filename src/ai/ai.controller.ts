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
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
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
  @Auth()
  @ApiOkResponse({ type: AiSuggestionsResponse })
  getRecommendations(
    @CurrentUser('id') userId: string
  ): Promise<AiSuggestionsResponse> {
    return this.aiService.getRecommendations(userId)
  }

  /** AI Picker — подбор под настроение */
  @Post('picker')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AiSuggestionsResponse })
  pick(
    @CurrentUser('id') userId: string,
    @Body() dto: PickerDto
  ): Promise<AiSuggestionsResponse> {
    return this.aiService.pick(userId, dto)
  }

  /** Описание без спойлеров для детальной страницы */
  @Get('summary/:slug')
  @Auth()
  @ApiOkResponse({ type: AiSummaryResponse })
  getSummary(@Param('slug') slug: string): Promise<AiSummaryResponse> {
    return this.aiService.getSpoilerFreeSummary(slug)
  }
}
