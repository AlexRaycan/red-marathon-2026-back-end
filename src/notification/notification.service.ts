import { Injectable, NotFoundException } from '@nestjs/common'

import { Prisma } from '../generated/prisma/client'
import { NotificationEntity, NotificationType } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { isHasMorePagination } from '../utils/is-has-more-pagination'

import { NotificationQueryDto } from './dto/notification-query.dto'
import { PushService } from './push.service'
import {
  NotificationListResponse,
  NotificationResponse
} from './response/notification-response'

/** Что нужно, чтобы создать уведомление из любого домена */
interface ICreateNotification {
  userId: string
  type: NotificationType
  title: string
  message: string
  entityType?: NotificationEntity
  entityId?: string
  actorId?: string
}

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private readonly pushService: PushService
  ) {}

  private SELECT_NOTIFICATION = {
    id: true,
    type: true,
    title: true,
    message: true,
    isRead: true,
    readAt: true,
    entityType: true,
    entityId: true,
    createdAt: true,
    actor: {
      select: {
        username: true,
        profile: { select: { displayName: true, avatarUrl: true } }
      }
    }
  }

  async findAll(
    userId: string,
    query: NotificationQueryDto
  ): Promise<NotificationListResponse> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isUnread === 'true' ? { isRead: false } : {})
    }

    const [items, totalCount, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        skip: query.skip,
        take: query.take,
        where,
        orderBy: { createdAt: 'desc' },
        select: this.SELECT_NOTIFICATION
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } })
    ])

    return {
      items: items.map(item => this._toResponse(item)),
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take),
      unreadCount
    }
  }

  async markAsRead(userId: string, id: string): Promise<NotificationResponse> {
    await this._ensureIsOwner(userId, id)

    const notification = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
      select: this.SELECT_NOTIFICATION
    })

    return this._toResponse(notification)
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() }
    })

    return true
  }

  async delete(userId: string, id: string): Promise<boolean> {
    await this._ensureIsOwner(userId, id)

    await this.prisma.notification.delete({ where: { id } })

    return true
  }

  /**
   * Вызывается из других доменов. Уведомление себе не отправляем —
   * шаринг коллекции с самим собой не должен создавать шум
   */
  async create(dto: ICreateNotification): Promise<void> {
    if (dto.userId === dto.actorId) return

    await this.prisma.notification.create({ data: dto })

    await this.pushService.send([dto.userId], dto.title, dto.message)
  }

  /** Пачкой — когда коллекцией делятся сразу с несколькими друзьями */
  async createMany(items: ICreateNotification[]): Promise<void> {
    const data = items.filter(({ userId, actorId }) => userId !== actorId)

    if (!data.length) return

    await this.prisma.notification.createMany({ data })

    // Текст у пачки общий — её создаёт одно событие вроде шаринга подборки
    const { title, message } = data[0]

    await this.pushService.send(
      data.map(({ userId }) => userId),
      title,
      message
    )
  }

  // Приватные хелперы

  private async _ensureIsOwner(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { userId: true }
    })

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found')
    }
  }

  private _toResponse(notification: {
    actor: {
      username: string
      profile: { displayName: string | null; avatarUrl: string | null } | null
    } | null
    [key: string]: unknown
  }): NotificationResponse {
    const { actor, ...rest } = notification

    return {
      ...rest,
      actor: actor
        ? {
            username: actor.username,
            displayName: actor.profile?.displayName ?? null,
            avatarUrl: actor.profile?.avatarUrl ?? null
          }
        : null
    } as NotificationResponse
  }
}
