import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { Prisma } from '../generated/prisma/client'
import { NotificationEntity, NotificationType } from '../generated/prisma/enums'
import { FriendshipService } from '../friendship/friendship.service'
import { IntegrationService } from '../integration/integration.service'
import { NotificationService } from '../notification/notification.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { FREE_PLAN_LIMITS } from '../constants/app.constants'
import { PrismaService } from '../prisma/prisma.service'
import {
  TITLE_LIST_ITEM_SELECT,
  toTitleListItemResponse
} from '../title/title-list-item'
import { generateSlug } from '../utils/generate-slug'
import { parseDiscoverKey } from '../utils/discover-key'
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
    private readonly subscriptionService: SubscriptionService,
    private readonly integrationService: IntegrationService
  ) {}

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
        titles: { select: TITLE_LIST_ITEM_SELECT }
      }
    })

    if (!collection || collection.userId !== userId) {
      throw new NotFoundException('Collection not found')
    }

    const { userId: _, titles, ...rest } = collection

    return {
      ...this._toListItem(rest),
      titles: titles.map(toTitleListItemResponse)
    }
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
        titles: { select: TITLE_LIST_ITEM_SELECT },
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

    const { user, _count, titles, ...rest } = collection

    return {
      ...rest,
      titles: titles.map(toTitleListItemResponse),
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
        titles: { select: TITLE_LIST_ITEM_SELECT }
      }
    })

    const { titles, ...rest } = collection

    return {
      ...this._toListItem(rest),
      titles: titles.map(toTitleListItemResponse)
    }
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

    await this.prisma.$transaction(async prisma => {
      await this._ensureTitlesExist(prisma, dto.titleIds)

      await prisma.collection.update({
        where: { id, userId },
        data: {
          titles: { connect: dto.titleIds.map(titleId => ({ id: titleId })) }
        }
      })
    })

    return this.findById(userId, id)
  }

  async removeTitles(
    userId: string,
    id: string,
    dto: CollectionTitlesDto
  ): Promise<CollectionResponse> {
    await this._ensureIsOwner(userId, id)

    await this.prisma.$transaction(async prisma => {
      await this._ensureTitlesExist(prisma, dto.titleIds)

      await prisma.collection.update({
        where: { id, userId },
        data: {
          titles: { disconnect: dto.titleIds.map(titleId => ({ id: titleId })) }
        }
      })
    })

    return this.findById(userId, id)
  }

  /** Внешний запрос — до транзакции; импорт и связь — атомарно */
  async addTitleByDiscoverKey(
    userId: string,
    id: string,
    key: string
  ): Promise<CollectionResponse> {
    // Чужая коллекция не должна расходовать квоту внешнего API
    await this._ensureIsOwner(userId, id)

    const { source, type, externalId } = parseDiscoverKey(key)

    const saveTitle = await this.integrationService.prepareImport(
      source,
      externalId,
      type
    )

    await this.prisma.$transaction(async prisma => {
      // Пока ждали внешний API, коллекцию могли удалить
      await this._ensureIsOwner(userId, id, prisma)

      const { id: titleId } = await saveTitle(prisma)

      // connect не дублирует существующую связь
      await prisma.collection.update({
        where: { id, userId },
        data: { titles: { connect: { id: titleId } } },
        select: { id: true }
      })
    })

    return this.findById(userId, id)
  }

  /** Удаление не импортирует тайтл и допускает отсутствие связи */
  async removeTitleByDiscoverKey(
    userId: string,
    id: string,
    key: string
  ): Promise<void> {
    await this._ensureIsOwner(userId, id)

    const { source, type, externalId } = parseDiscoverKey(key)

    const title = await this.integrationService.findImported(
      source,
      externalId,
      type
    )

    if (!title) return

    await this.prisma.collection.update({
      where: { id, userId },
      data: { titles: { disconnect: { id: title.id } } },
      select: { id: true }
    })
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

  /** Весь список проверяем до изменения связей, повторяющиеся id допустимы */
  private async _ensureTitlesExist(
    prisma: Prisma.TransactionClient,
    titleIds: string[]
  ): Promise<void> {
    const count = await prisma.title.count({
      where: { id: { in: titleIds } }
    })

    if (count !== new Set(titleIds).size) {
      throw new NotFoundException('Title not found')
    }
  }

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

  private async _ensureIsOwner(
    userId: string,
    id: string,
    prisma: Prisma.TransactionClient = this.prisma
  ): Promise<void> {
    const collection = await prisma.collection.findUnique({
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
