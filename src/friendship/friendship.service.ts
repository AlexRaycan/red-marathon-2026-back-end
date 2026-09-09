import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { FriendshipStatus, NotificationType } from '../generated/prisma/enums'
import { NotificationService } from '../notification/notification.service'
import { PrismaService } from '../prisma/prisma.service'

import {
  FriendListResponse,
  FriendRequestListResponse,
  FriendResponse
} from './response/friendship-response'

@Injectable()
export class FriendshipService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService
  ) {}

  private SELECT_USER = {
    id: true,
    username: true,
    profile: { select: { displayName: true, avatarUrl: true } }
  }

  /** Список друзей: заявка принята, направление уже не важно */
  async findAll(userId: string): Promise<FriendListResponse> {
    const items = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
      orderBy: { acceptedAt: 'desc' },
      select: {
        sender: { select: this.SELECT_USER },
        receiver: { select: this.SELECT_USER }
      }
    })

    const friends = items.map(({ sender, receiver }) =>
      this._toFriend(sender.id === userId ? receiver : sender)
    )

    return { items: friends, totalCount: friends.length }
  }

  /** Входящие заявки — их показываем на отдельном экране */
  async findRequests(userId: string): Promise<FriendRequestListResponse> {
    const items = await this.prisma.friendship.findMany({
      where: { receiverId: userId, status: FriendshipStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        sender: { select: this.SELECT_USER }
      }
    })

    return {
      items: items.map(({ id, createdAt, sender }) => ({
        id,
        createdAt,
        user: this._toFriend(sender)
      })),
      totalCount: items.length
    }
  }

  async request(userId: string, username: string): Promise<boolean> {
    const receiver = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true }
    })

    if (!receiver) throw new NotFoundException('User not found')

    if (receiver.id === userId) {
      throw new BadRequestException('You cannot add yourself')
    }

    const existing = await this._findBetween(userId, receiver.id)

    if (existing?.status === FriendshipStatus.ACCEPTED) {
      throw new BadRequestException('You are already friends')
    }

    // Встречная заявка — сразу дружим, второй раз подтверждать незачем
    if (existing?.receiverId === userId) {
      return this.accept(userId, existing.id)
    }

    if (existing) throw new BadRequestException('Request is already sent')

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    })

    await this.prisma.friendship.create({
      data: { senderId: userId, receiverId: receiver.id }
    })

    await this.notificationService.create({
      userId: receiver.id,
      actorId: userId,
      type: NotificationType.FRIEND_REQUEST,
      title: 'New friend request',
      message: `${sender?.username} wants to be your friend`
    })

    return true
  }

  async accept(userId: string, id: string): Promise<boolean> {
    const request = await this.prisma.friendship.findUnique({
      where: { id },
      select: { id: true, status: true, senderId: true, receiverId: true }
    })

    // Принять может только получатель заявки
    if (!request || request.receiverId !== userId) {
      throw new NotFoundException('Request not found')
    }

    if (request.status === FriendshipStatus.ACCEPTED) return true

    await this.prisma.friendship.update({
      where: { id },
      data: { status: FriendshipStatus.ACCEPTED, acceptedAt: new Date() }
    })

    const receiver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    })

    await this.notificationService.create({
      userId: request.senderId,
      actorId: userId,
      type: NotificationType.FRIEND_ACCEPTED,
      title: 'Request accepted',
      message: `${receiver?.username} accepted your friend request`
    })

    return true
  }

  /** Одним методом отклоняем заявку и удаляем из друзей */
  async remove(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.friendship.deleteMany({
      where: { id, OR: [{ senderId: userId }, { receiverId: userId }] }
    })

    if (!count) throw new NotFoundException('Request not found')

    return true
  }

  /** Кому этот юзер может отправить подборку */
  async findFriendIds(userId: string): Promise<string[]> {
    const items = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
      select: { senderId: true, receiverId: true }
    })

    return items.map(({ senderId, receiverId }) =>
      senderId === userId ? receiverId : senderId
    )
  }

  private _findBetween(userId: string, otherId: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: otherId },
          { senderId: otherId, receiverId: userId }
        ]
      },
      select: { id: true, status: true, receiverId: true }
    })
  }

  private _toFriend(user: {
    id: string
    username: string
    profile: { displayName: string | null; avatarUrl: string | null } | null
  }): FriendResponse {
    return {
      id: user.id,
      username: user.username,
      displayName: user.profile?.displayName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null
    }
  }
}
