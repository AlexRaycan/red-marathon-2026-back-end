import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards
} from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

import { AiService } from '../ai/ai.service'
import { TasteInsightResponse } from '../ai/response/ai-response'
import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ErrorResponse } from '../common/response/error-response'
import { AI_RATE_LIMIT, AI_RATE_TTL_MS } from '../constants/ai.constants'

import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import {
  PublicProfileResponse,
  TasteStatsResponse,
  UserResponse
} from './response/user-response'
import { UserService } from './user.service'

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly aiService: AiService
  ) {}

  @Get('me')
  @ApiOperation({ operationId: 'currentUser' })
  @Auth()
  @ApiOkResponse({ type: UserResponse })
  findMe(@CurrentUser('id') userId: string): Promise<UserResponse> {
    return this.userService.findMe(userId)
  }

  @Patch('me')
  @ApiOperation({ operationId: 'updateProfile' })
  @Auth()
  @ApiOkResponse({ type: UserResponse })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto
  ): Promise<UserResponse> {
    return this.userService.updateProfile(userId, dto)
  }

  @Get('me/taste')
  @ApiOperation({ operationId: 'myTasteStats' })
  @Auth()
  @ApiOkResponse({ type: TasteStatsResponse })
  getMyTaste(@CurrentUser('id') userId: string): Promise<TasteStatsResponse> {
    return this.userService.getTasteStats(userId)
  }

  /**
   * Текст Taste DNA от модели. Обновляется раз в неделю; на бесплатном
   * тарифе генерация входит в дневной лимит AI-запросов
   */
  @Get('me/taste/insight')
  @ApiOperation({ operationId: 'myTasteInsight' })
  @Auth()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: AI_RATE_LIMIT, ttl: AI_RATE_TTL_MS } })
  @ApiOkResponse({ type: TasteInsightResponse })
  @ApiTooManyRequestsResponse({ type: ErrorResponse })
  getMyTasteInsight(
    @CurrentUser('id') userId: string
  ): Promise<TasteInsightResponse> {
    return this.aiService.getTasteInsight(userId)
  }

  @Patch('me/password')
  @ApiOperation({ operationId: 'changePassword' })
  @Auth()
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto
  ): Promise<boolean> {
    return this.userService.changePassword(userId, dto)
  }

  @Delete('me')
  @ApiOperation({ operationId: 'deleteAccount' })
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(@CurrentUser('id') userId: string): Promise<boolean> {
    return this.userService.deleteMe(userId)
  }

  /** Публичный Taste DNA по ссылке — открывается без авторизации */
  @Get('public/:username')
  @ApiOperation({ operationId: 'publicProfileByUsername' })
  @ApiOkResponse({ type: PublicProfileResponse })
  findPublic(
    @Param('username') username: string
  ): Promise<PublicProfileResponse> {
    return this.userService.findPublicByUsername(username)
  }
}
