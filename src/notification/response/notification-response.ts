import {
  NotificationEntity,
  NotificationType
} from '../../generated/prisma/enums'

export class NotificationActorResponse {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export class NotificationResponse {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  readAt: Date | null
  /** Куда вести по клику: тип объекта и его id */
  entityType: NotificationEntity | null
  entityId: string | null
  /** Кто спровоцировал событие, если это не системное уведомление */
  actor: NotificationActorResponse | null
  createdAt: Date
}

export class NotificationListResponse {
  items: NotificationResponse[]
  isHasMore: boolean
  unreadCount: number
}
