import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post
} from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { FriendRequestDto } from './dto/friend-request.dto'
import { FriendshipService } from './friendship.service'
import {
  FriendListResponse,
  FriendRequestListResponse
} from './response/friendship-response'

@ApiTags('friends')
@Controller('friends')
export class FriendshipController {
  constructor(private readonly friendshipService: FriendshipService) {}

  @Get()
  @Auth()
  @ApiOkResponse({ type: FriendListResponse })
  findAll(@CurrentUser('id') userId: string): Promise<FriendListResponse> {
    return this.friendshipService.findAll(userId)
  }

  /** Входящие заявки */
  @Get('requests')
  @Auth()
  @ApiOkResponse({ type: FriendRequestListResponse })
  findRequests(
    @CurrentUser('id') userId: string
  ): Promise<FriendRequestListResponse> {
    return this.friendshipService.findRequests(userId)
  }

  @Post('requests')
  @Auth()
  @HttpCode(HttpStatus.OK)
  request(
    @CurrentUser('id') userId: string,
    @Body() dto: FriendRequestDto
  ): Promise<boolean> {
    return this.friendshipService.request(userId, dto.username)
  }

  @Post('requests/:id/accept')
  @Auth()
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.friendshipService.accept(userId, id)
  }

  /** Отклонить заявку или удалить из друзей */
  @Delete(':id')
  @Auth()
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.friendshipService.remove(userId, id)
  }
}
