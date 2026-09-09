import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch
} from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import {
  PublicProfileResponse,
  RatingScaleRuleResponse,
  TasteStatsResponse,
  UserResponse
} from './response/user-response'
import { UserService } from './user.service'

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @Auth()
  @ApiOkResponse({ type: UserResponse })
  findMe(@CurrentUser('id') userId: string): Promise<UserResponse> {
    return this.userService.findMe(userId)
  }

  @Patch('me')
  @Auth()
  @ApiOkResponse({ type: UserResponse })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto
  ): Promise<UserResponse> {
    return this.userService.updateProfile(userId, dto)
  }

  @Get('me/taste')
  @Auth()
  @ApiOkResponse({ type: TasteStatsResponse })
  getMyTaste(@CurrentUser('id') userId: string): Promise<TasteStatsResponse> {
    return this.userService.getTasteStats(userId)
  }

  /** Какую шкалу оценок показывать для каждого типа тайтла */
  @Get('me/rating-scale')
  @Auth()
  @ApiOkResponse({ type: RatingScaleRuleResponse })
  getRatingScale(
    @CurrentUser('id') userId: string
  ): Promise<RatingScaleRuleResponse> {
    return this.userService.getRatingScaleRule(userId)
  }

  @Patch('me/password')
  @Auth()
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto
  ): Promise<boolean> {
    return this.userService.changePassword(userId, dto)
  }

  @Delete('me')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(@CurrentUser('id') userId: string): Promise<boolean> {
    return this.userService.deleteMe(userId)
  }

  /** Публичный Taste DNA по ссылке — открывается без авторизации */
  @Get('public/:username')
  @ApiOkResponse({ type: PublicProfileResponse })
  findPublic(
    @Param('username') username: string
  ): Promise<PublicProfileResponse> {
    return this.userService.findPublicByUsername(username)
  }
}
