import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { Prisma } from '../generated/prisma/client'
import { NotificationEntity, NotificationType } from '../generated/prisma/enums'
import { FriendshipService } from '../friendship/friendship.service'
import { NotificationService } from '../notification/notification.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { FREE_PLAN_LIMITS } from '../constants/app.constants'
import { PrismaService } from '../prisma/prisma.service'
import { generateSlug } from '../utils/generate-slug'
import { isHasMorePagination } from '../utils/is-has-more-pagination'

import { PaginationQueryDto } from '../base/pagination-query.dto'

import { CollectionTitlesDto } from './dto/collection-titles.dto'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { ShareCollectionDto } from './dto/share-collection.dto'
import { UpdateCollectionDto } from './dto/update-collection.dto'
import {
  CollectionListResponse,
  CollectionResponse,
  PublicCollectionResponse
} from './response/collection-response'

@Injectable()
export class CollectionService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly friendshipService: FriendshipService,
    private readonly subscriptionService: SubscriptionService
  ) {}

  private SELECT_TITLE = {
    id: true,
    type: true,
    name: true,
    slug: true,
    coverUrl: true,
    releaseDate: true,
    rating: true,
    ratingCount: true
  }

  private SELECT_LIST_ITEM = {
    id: true,
    name: true,
    slug: true,
    description: true,
    coverUrl: true,
    isPublic: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { titles: true } }
  }

  async findAll(
    userId: string,
    query: PaginationQueryDto
  ): Promise<CollectionListResponse> {
    const where: Prisma.CollectionWhereInput = {
      userId,
      ...(query.searchTerm
        ? { name: { contains: query.searchTerm, mode: 'insensitive' } }
        : {})
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.collection.findMany({
        skip: query.skip,
        take: query.take,
        where,
        orderBy: { updatedAt: 'desc' },
        select: this.SELECT_LIST_ITEM
      }),
      this.prisma.collection.count({ where })
    ])

    return {
      items: items.map(item => this._toListItem(item)),
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take)
    }
  }

  async findById(userId: string, id: string): Promise<CollectionResponse> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: {
        ...this.SELECT_LIST_ITEM,
        userId: true,
        titles: { select: this.SELECT_TITLE }
      }
    })

    if (!collection || collection.userId !== userId) {
      throw new NotFoundException('Collection not found')
    }

    const { userId: _, titles, ...rest } = collection

    return { ...this._toListItem(rest), titles }
  }

  /** Публичная подборка по ссылке — открывается без авторизации */
  async findPublicBySlug(
    username: string,
    slug: string
  ): Promise<PublicCollectionResponse> {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, isPublic: true, user: { username } },
      select: {
        name: true,
        slug: true,
        description: true,
        coverUrl: true,
        createdAt: true,
        _count: { select: { titles: true } },
        titles: { select: this.SELECT_TITLE },
        user: {
          select: {
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } }
          }
        }
      }
    })

    // Приватную отдаём как 404, чтобы нельзя было перебором найти чужие
    if (!collection) throw new NotFoundException('Collection not found')

    const { user, _count, ...rest } = collection

    return {
      ...rest,
      titlesCount: _count.titles,
      owner: {
        username: user.username,
        displayName: user.profile?.displayName ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null
      }
    }
  }

  async create(
    userId: string,
    dto: CreateCollectionDto
  ): Promise<CollectionResponse> {
    await this._ensureWithinPlanLimit(userId)

    const collection = await this.prisma.collection.create({
      data: {
        ...dto,
        slug: await this._getUniqueSlug(userId, dto.name),
        userId
      },
      select: {
        ...this.SELECT_LIST_ITEM,
        titles: { select: this.SELECT_TITLE }
      }
    })

    const { titles, ...rest } = collection

    return { ...this._toListItem(rest), titles }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCollectionDto
  ): Promise<CollectionResponse> {
    await this._ensureIsOwner(userId, id)

    // Slug меняем вслед за названием — публичная ссылка должна оставаться читаемой
    const slug = dto.name
      ? { slug: await this._getUniqueSlug(userId, dto.name, id) }
      : {}

    await this.prisma.collection.update({
      where: { id },
      data: { ...dto, ...slug }
    })

    return this.findById(userId, id)
  }

  async addTitles(
    userId: string,
    id: string,
    dto: CollectionTitlesDto
  ): Promise<CollectionResponse> {
    await this._ensureIsOwner(userId, id)

    await this.prisma.collection.update({
      where: { id },
      data: {
        titles: { connect: dto.titleIds.map(titleId => ({ id: titleId })) }
      }
    })

    return this.findById(userId, id)
  }

  async removeTitles(
    userId: string,
    id: string,
    dto: CollectionTitlesDto
  ): Promise<CollectionResponse> {
    await this._ensureIsOwner(userId, id)

    await this.prisma.collection.update({
      where: { id },
      data: {
        titles: { disconnect: dto.titleIds.map(titleId => ({ id: titleId })) }
      }
    })

    return this.findById(userId, id)
  }

  async delete(userId: string, id: string): Promise<boolean> {
    await this._ensureIsOwner(userId, id)

    await this.prisma.collection.delete({ where: { id } })

    return true
  }

  /** Поделиться подборкой: получатели увидят уведомление */
  async share(
    userId: string,
    id: string,
    dto: ShareCollectionDto
  ): Promise<boolean> {
    await this._ensureIsOwner(userId, id)

    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { name: true, slug: true, isPublic: true }
    })

    // Приватную подборку получатель открыть не сможет — уведомление
    // вело бы в 404, поэтому просим сначала сделать её публичной
    if (!collection?.isPublic) {
      throw new BadRequestException('Make the collection public before sharing')
    }

    const [author, friendIds] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true }
      }),
      this.friendshipService.findFriendIds(userId)
    ])

    // Отправить можно только друзьям — чужие id из запроса отсекаем
    const recipients = dto.friendIds.filter(id => friendIds.includes(id))

    if (!recipients.length) throw new NotFoundException('No recipients found')

    await this.notificationService.createMany(
      recipients.map(recipientId => ({
        userId: recipientId,
        actorId: userId,
        type: NotificationType.COLLECTION_SHARED,
        title: 'A collection was shared with you',
        message: `${author?.username} shared "${collection.name}" with you`,
        entityType: NotificationEntity.COLLECTION,
        entityId: id
      }))
    )

    return true
  }

  // Приватные хелперы

  /** На бесплатном тарифе число подборок ограничено */
  private async _ensureWithinPlanLimit(userId: string): Promise<void> {
    if (await this.subscriptionService.isProActive(userId)) return

    const count = await this.prisma.collection.count({ where: { userId } })

    if (count >= FREE_PLAN_LIMITS.collections) {
      throw new BadRequestException(
        `Free plan is limited to ${FREE_PLAN_LIMITS.collections} collections. Upgrade to add more`
      )
    }
  }

  private async _ensureIsOwner(userId: string, id: string): Promise<void> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { userId: true }
    })

    if (!collection || collection.userId !== userId) {
      throw new NotFoundException('Collection not found')
    }
  }

  /** Slug уникален внутри пользователя: «ведьмак», «ведьмак-2», … */
  private async _getUniqueSlug(
    userId: string,
    name: string,
    excludeId?: string
  ): Promise<string> {
    const base = generateSlug(name) || 'collection'

    for (let suffix = 0; suffix < 100; suffix++) {
      const slug = suffix ? `${base}-${suffix + 1}` : base

      const existing = await this.prisma.collection.findFirst({
        where: {
          userId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {})
        },
        select: { id: true }
      })

      if (!existing) return slug
    }

    return `${base}-${Date.now()}`
  }

  private _toListItem<T extends { _count: { titles: number } }>(
    item: T
  ): Omit<T, '_count'> & { titlesCount: number } {
    const { _count, ...rest } = item

    return { ...rest, titlesCount: _count.titles }
  }
}
