import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { FREE_PLAN_LIMITS } from '../constants/app.constants'
import { Prisma } from '../generated/prisma/client'
import { LibraryStatus } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { isHasMorePagination } from '../utils/is-has-more-pagination'

import { CreateLibraryEntryDto } from './dto/create-library-entry.dto'
import { LibraryQueryDto, LibrarySortEnum } from './dto/library-query.dto'
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto'
import {
  LibraryEntryResponse,
  LibraryListResponse
} from './response/library-response'

@Injectable()
export class LibraryService {
  constructor(
    private prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService
  ) {}

  private SELECT_ENTRY = {
    id: true,
    status: true,
    progress: true,
    progressUnit: true,
    rating: true,
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
        ratingCount: true
      }
    }
  }

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
        select: this.SELECT_ENTRY
      }),
      this.prisma.libraryEntry.count({ where })
    ])

    return {
      items,
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take)
    }
  }

  /** Запись по тайтлу — карточка тайтла показывает, что он уже в библиотеке */
  async findByTitle(
    userId: string,
    titleId: string
  ): Promise<LibraryEntryResponse | null> {
    return this.prisma.libraryEntry.findUnique({
      where: { userId_titleId: { userId, titleId } },
      select: this.SELECT_ENTRY
    })
  }

  async create(
    userId: string,
    dto: CreateLibraryEntryDto
  ): Promise<LibraryEntryResponse> {
    await this._ensureWithinPlanLimit(userId)

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

    const { titleId, startedAt, finishedAt, ...rest } = dto

    return this.prisma.libraryEntry.create({
      data: {
        ...rest,
        ...this._getDateFields(dto),
        userId,
        titleId
      },
      select: this.SELECT_ENTRY
    })
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateLibraryEntryDto
  ): Promise<LibraryEntryResponse> {
    const entry = await this._findOwnEntry(userId, id)

    const { startedAt, finishedAt, ...rest } = dto

    return this.prisma.libraryEntry.update({
      where: { id: entry.id },
      data: {
        ...rest,
        ...this._getDateFields(dto, entry.startedAt)
      },
      select: this.SELECT_ENTRY
    })
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const entry = await this._findOwnEntry(userId, id)

    await this.prisma.libraryEntry.delete({ where: { id: entry.id } })

    return true
  }

  // Приватные хелперы

  /** На бесплатном тарифе размер библиотеки ограничен */
  private async _ensureWithinPlanLimit(userId: string): Promise<void> {
    if (await this.subscriptionService.isProActive(userId)) return

    const count = await this.prisma.libraryEntry.count({ where: { userId } })

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
    if (sort === LibrarySortEnum.Rating) return { rating: 'desc' }
    if (sort === LibrarySortEnum.Name) return { title: { name: 'asc' } }

    return { updatedAt: 'desc' }
  }
}
