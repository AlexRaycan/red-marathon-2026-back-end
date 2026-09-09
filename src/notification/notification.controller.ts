import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { NotificationQueryDto } from './dto/notification-query.dto'
import { PushTokenDto } from './dto/push-token.dto'
import { NotificationService } from './notification.service'
import { PushService } from './push.service'
import {
  NotificationListResponse,
  NotificationResponse
} from './response/notification-response'

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushService: PushService
  ) {}

  /** Мобильное приложение присылает токен устройства после разрешения */
  @Post('push-token')
  @Auth()
  @HttpCode(HttpStatus.OK)
  registerPushToken(
    @CurrentUser('id') userId: string,
    @Body() dto: PushTokenDto
  ): Promise<boolean> {
    return this.pushService.register(userId, dto)
  }

  /** Юзер выключил уведомления или вышел из аккаунта */
  @Delete('push-token/:token')
  @Auth()
  @HttpCode(HttpStatus.OK)
  removePushToken(
    @CurrentUser('id') userId: string,
    @Param('token') token: string
  ): Promise<boolean> {
    return this.pushService.unregister(userId, token)
  }

  @Get()
  @Auth()
  @ApiOkResponse({ type: NotificationListResponse })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationQueryDto
  ): Promise<NotificationListResponse> {
    return this.notificationService.findAll(userId, query)
  }

  @Patch(':id/read')
  @Auth()
  @ApiOkResponse({ type: NotificationResponse })
  markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<NotificationResponse> {
    return this.notificationService.markAsRead(userId, id)
  }

  @Patch('read-all')
  @Auth()
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser('id') userId: string): Promise<boolean> {
    return this.notificationService.markAllAsRead(userId)
  }

  @Delete(':id')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.notificationService.delete(userId, id)
  }
}
