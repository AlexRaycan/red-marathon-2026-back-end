import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { FREE_PLAN_LIMITS } from '../constants/app.constants'
import { Prisma } from '../generated/prisma/client'
import { LibraryStatus } from '../generated/prisma/enums'
import { IntegrationService } from '../integration/integration.service'
import { PrismaService } from '../prisma/prisma.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { parseDiscoverKey } from '../utils/discover-key'
import { isHasMorePagination } from '../utils/is-has-more-pagination'

import { CreateLibraryEntryDto } from './dto/create-library-entry.dto'
import { LibraryQueryDto, LibrarySortEnum } from './dto/library-query.dto'
import { SetLibraryStatusDto } from './dto/set-library-status.dto'
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto'
import {
  LibraryEntryResponse,
  LibraryListResponse
} from './response/library-response'

type TLibraryEntryRow = Prisma.LibraryEntryGetPayload<{
  select: ReturnType<LibraryService['_getSelectEntry']>
}>

@Injectable()
export class LibraryService {
  constructor(
    private prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly integrationService: IntegrationService
  ) {}

  async findAll(
    userId: string,
    query: LibraryQueryDto
  ): Promise<LibraryListResponse> {
    const where = this._getFilters(userId, query)

    const [items, totalCount] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        skip: query.skip,
        take: query.take,
        where,
        orderBy: this._getOrderBy(query.sort),
        select: this._getSelectEntry(userId)
      }),
      this.prisma.libraryEntry.count({ where })
    ])

    return {
      items: items.map(item => this._toResponse(item)),
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take)
    }
  }

  /** Запись по тайтлу — карточка тайтла показывает, что он уже в библиотеке */
  async findByTitle(
    userId: string,
    titleId: string
  ): Promise<LibraryEntryResponse | null> {
    const entry = await this.prisma.libraryEntry.findUnique({
      where: { userId_titleId: { userId, titleId } },
      select: this._getSelectEntry(userId)
    })

    return entry ? this._toResponse(entry) : null
  }

  async create(
    userId: string,
    dto: CreateLibraryEntryDto
  ): Promise<LibraryEntryResponse> {
    const title = await this.prisma.title.findUnique({
      where: { id: dto.titleId },
      select: { id: true }
    })

    if (!title) throw new NotFoundException('Title not found')

    const existing = await this.prisma.libraryEntry.findUnique({
      where: { userId_titleId: { userId, titleId: dto.titleId } },
      select: { id: true }
    })

    if (existing)
      throw new BadRequestException('Title is already in your library')

    await this._ensureWithinPlanLimit(this.prisma, userId)

    const { titleId, startedAt, finishedAt, ...rest } = dto

    const entry = await this.prisma.libraryEntry.create({
      data: {
        ...rest,
        ...this._getDateFields(dto),
        userId,
        titleId
      },
      select: this._getSelectEntry(userId)
    })

    return this._toResponse(entry)
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateLibraryEntryDto
  ): Promise<LibraryEntryResponse> {
    const entry = await this._findOwnEntry(userId, id)

    const { startedAt, finishedAt, ...rest } = dto

    const updated = await this.prisma.libraryEntry.update({
      where: { id: entry.id },
      data: {
        ...rest,
        ...this._getDateFields(dto, entry.startedAt)
      },
      select: this._getSelectEntry(userId)
    })

    return this._toResponse(updated)
  }

  /**
   * Статус по ключу витрины — тайтл сохранится у нас вместе с записью.
   * Повторный вызов не ошибка: запись уже есть — меняем ей статус
   */
  async setStatusByDiscoverKey(
    userId: string,
    key: string,
    dto: SetLibraryStatusDto
  ): Promise<LibraryEntryResponse> {
    const { source, type, externalId } = parseDiscoverKey(key)

    const saveTitle = await this.integrationService.prepareImport(
      source,
      externalId,
      type
    )

    return this.prisma.$transaction(async prisma => {
      const { id: titleId } = await saveTitle(prisma)

      const existing = await prisma.libraryEntry.findUnique({
        where: { userId_titleId: { userId, titleId } },
        select: { startedAt: true }
      })

      if (!existing) await this._ensureWithinPlanLimit(prisma, userId)

      const data = {
        status: dto.status,
        ...this._getDateFields(dto, existing?.startedAt)
      }

      // upsert, а не create: параллельный PUT того же тайтла обновит
      // запись первого, а не упадёт на уникальном индексе. Полную запись
      // читаем отдельно — вложенная выборка в upsert отключает ON CONFLICT
      const { id } = await prisma.libraryEntry.upsert({
        where: { userId_titleId: { userId, titleId } },
        create: { ...data, userId, titleId },
        update: data,
        select: { id: true }
      })

      const entry = await prisma.libraryEntry.findUniqueOrThrow({
        where: { id },
        select: this._getSelectEntry(userId)
      })

      return this._toResponse(entry)
    })
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const entry = await this._findOwnEntry(userId, id)

    await this.prisma.libraryEntry.delete({ where: { id: entry.id } })

    return true
  }

  /** Отзыв не трогаем: оценка остаётся, даже если тайтл убрали из библиотеки */
  async deleteByDiscoverKey(userId: string, key: string): Promise<boolean> {
    const { source, type, externalId } = parseDiscoverKey(key)

    const title = await this.integrationService.findImported(
      source,
      externalId,
      type
    )

    // deleteMany не падает, если записи нет: повторное удаление — не ошибка
    if (title) {
      await this.prisma.libraryEntry.deleteMany({
        where: { userId, titleId: title.id }
      })
    }

    return true
  }

  // Приватные хелперы

  /**
   * Оценка живёт в отзыве, а не в записи библиотеки. Подтягиваем её
   * в той же выборке: отзыв у пользователя на тайтл максимум один
   */
  private _getSelectEntry(userId: string) {
    return {
      id: true,
      status: true,
      progress: true,
      progressUnit: true,
      note: true,
      isFavorite: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
      title: {
        select: {
          id: true,
          type: true,
          name: true,
          slug: true,
          coverUrl: true,
          releaseDate: true,
          rating: true,
          ratingCount: true,
          reviews: { where: { userId }, select: { rating: true } }
        }
      }
    } satisfies Prisma.LibraryEntrySelect
  }

  private _toResponse({
    title: { reviews, ...title },
    ...entry
  }: TLibraryEntryRow): LibraryEntryResponse {
    return { ...entry, title, rating: reviews[0]?.rating ?? null }
  }

  /** На бесплатном тарифе размер библиотеки ограничен */
  private async _ensureWithinPlanLimit(
    prisma: Prisma.TransactionClient,
    userId: string
  ): Promise<void> {
    if (await this.subscriptionService.isProActive(userId)) return

    const count = await prisma.libraryEntry.count({ where: { userId } })

    if (count >= FREE_PLAN_LIMITS.libraryEntries) {
      throw new BadRequestException(
        `Free plan is limited to ${FREE_PLAN_LIMITS.libraryEntries} titles. Upgrade to add more`
      )
    }
  }

  private async _findOwnEntry(userId: string, id: string) {
    const entry = await this.prisma.libraryEntry.findUnique({
      where: { id },
      select: { id: true, userId: true, startedAt: true }
    })

    // Чужую запись отдаём как 404, чтобы не подтверждать её существование
    if (!entry || entry.userId !== userId) {
      throw new NotFoundException('Entry not found')
    }

    return entry
  }

  /**
   * Даты проставляются автоматически по статусу: взял в работу — startedAt,
   * завершил — finishedAt. Но если клиент прислал дату явно
   * («прошёл ещё в марте»), она побеждает автоматическую.
   */
  private _getDateFields(
    dto: { status?: LibraryStatus; startedAt?: string; finishedAt?: string },
    currentStartedAt?: Date | null
  ): { startedAt?: Date; finishedAt?: Date } {
    const { status, startedAt, finishedAt } = dto

    const auto: { startedAt?: Date; finishedAt?: Date } = {}

    if (status === LibraryStatus.IN_PROGRESS && !currentStartedAt) {
      auto.startedAt = new Date()
    }

    if (status === LibraryStatus.COMPLETED) {
      auto.finishedAt = new Date()

      if (!currentStartedAt) auto.startedAt = new Date()
    }

    return {
      ...auto,
      ...(startedAt ? { startedAt: new Date(startedAt) } : {}),
      ...(finishedAt ? { finishedAt: new Date(finishedAt) } : {})
    }
  }

  private _getFilters(
    userId: string,
    query: LibraryQueryDto
  ): Prisma.LibraryEntryWhereInput {
    const { status, type, isFavorite, searchTerm } = query

    return {
      userId,
      ...(status?.length ? { status: { in: status } } : {}),
      ...(isFavorite ? { isFavorite: isFavorite === 'true' } : {}),
      ...(type?.length || searchTerm
        ? {
            title: {
              ...(type?.length ? { type: { in: type } } : {}),
              ...(searchTerm
                ? { name: { contains: searchTerm, mode: 'insensitive' } }
                : {})
            }
          }
        : {})
    }
  }

  private _getOrderBy(
    sort?: LibrarySortEnum
  ): Prisma.LibraryEntryOrderByWithRelationInput {
    if (sort === LibrarySortEnum.Name) return { title: { name: 'asc' } }

    return { updatedAt: 'desc' }
  }
}
