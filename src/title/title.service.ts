import { Injectable, NotFoundException } from '@nestjs/common'

import { SEARCH_SUGGEST_TAKE, SIMILAR_TAKE } from '../constants/app.constants'
import { Prisma } from '../generated/prisma/client'
import { TitleStatus } from '../generated/prisma/enums'
import { IntegrationService } from '../integration/integration.service'
import { PrismaService } from '../prisma/prisma.service'
import { isHasMorePagination } from '../utils/is-has-more-pagination'

import { SearchQueryDto } from './dto/search-query.dto'
import { TitleQueryDto, TitleSortEnum } from './dto/title-query.dto'
import {
  TitleListItemResponse,
  TitleListResponse,
  TitleResponse
} from './response/title-response'

@Injectable()
export class TitleService {
  constructor(
    private prisma: PrismaService,
    private readonly integrationService: IntegrationService
  ) {}

  // Карточка списка: тяжёлые поля не тянем
  private SELECT_LIST_ITEM = {
    id: true,
    type: true,
    name: true,
    slug: true,
    coverUrl: true,
    releaseDate: true,
    rating: true,
    ratingCount: true
  }

  private SELECT_DETAILS = {
    ...this.SELECT_LIST_ITEM,
    status: true,
    originalName: true,
    externalId: true,
    externalSource: true,
    createdAt: true,
    genres: { select: { id: true, name: true, slug: true } }
  }

  async findAll(query: TitleQueryDto): Promise<TitleListResponse> {
    const where = this._getFilters(query)

    const [items, totalCount] = await Promise.all([
      this.prisma.title.findMany({
        skip: query.skip,
        take: query.take,
        where,
        orderBy: this._getOrderBy(query.sort),
        select: this.SELECT_LIST_ITEM
      }),
      this.prisma.title.count({ where })
    ])

    return {
      items,
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take)
    }
  }

  async findBySlug(slug: string): Promise<TitleResponse> {
    const title = await this.prisma.title.findUnique({
      where: { slug },
      select: this.SELECT_DETAILS
    })

    if (!title || title.status !== TitleStatus.PUBLISHED) {
      throw new NotFoundException('Title not found')
    }

    const { externalId, externalSource, ...rest } = title

    // Описание и актёров берём из внешнего API: у нас чужой контент
    // не хранится, зато он всегда свежий
    const [similar, details] = await Promise.all([
      this._getSimilar(title),
      externalId && externalSource
        ? this.integrationService.getTitleDetails(
            externalSource,
            externalId,
            title.type
          )
        : null
    ])

    return {
      ...rest,
      similar,
      description: details?.description ?? null,
      actors: (details?.actors ?? []).map(({ name, photoUrl }) => ({
        name,
        photoUrl: photoUrl ?? null
      })),
      metadata: details?.metadata ?? {}
    }
  }

  /** Сквозной поиск по всем типам — им же пользуется расширение */
  async search(query: SearchQueryDto): Promise<TitleListResponse> {
    const where: Prisma.TitleWhereInput = {
      status: TitleStatus.PUBLISHED,
      ...this._getSearchTermFilter(query.q),
      ...(query.type?.length ? { type: { in: query.type } } : {})
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.title.findMany({
        skip: query.skip,
        take: query.take,
        where,
        // Сначала популярное: по неточному названию это чаще нужный тайтл
        orderBy: [{ ratingCount: 'desc' }, { rating: 'desc' }],
        select: this.SELECT_LIST_ITEM
      }),
      this.prisma.title.count({ where })
    ])

    return {
      items,
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take)
    }
  }

  /** Подсказки в поисковой строке — короткий список, без счётчика */
  async suggest(q: string): Promise<TitleListItemResponse[]> {
    return this.prisma.title.findMany({
      where: {
        status: TitleStatus.PUBLISHED,
        ...this._getSearchTermFilter(q)
      },
      take: SEARCH_SUGGEST_TAKE,
      orderBy: { ratingCount: 'desc' },
      select: this.SELECT_LIST_ITEM
    })
  }

  // Приватные хелперы

  /** Похожие по жанрам. Тип не фиксируем: по «Ведьмаку» уместны и книга, и сериал */
  private async _getSimilar(title: {
    id: string
    genres: { id: string }[]
  }): Promise<TitleListItemResponse[]> {
    return this.prisma.title.findMany({
      where: {
        id: { not: title.id },
        status: TitleStatus.PUBLISHED,
        genres: { some: { id: { in: title.genres.map(({ id }) => id) } } }
      },
      take: SIMILAR_TAKE,
      orderBy: [{ ratingCount: 'desc' }, { rating: 'desc' }],
      select: this.SELECT_LIST_ITEM
    })
  }

  private _getFilters(query: TitleQueryDto): Prisma.TitleWhereInput {
    const { type, genres, minRating, yearFrom, yearTo, searchTerm } = query

    return {
      status: TitleStatus.PUBLISHED,
      ...this._getSearchTermFilter(searchTerm),
      ...(type?.length ? { type: { in: type } } : {}),
      ...(genres?.length ? { genres: { some: { slug: { in: genres } } } } : {}),
      ...(minRating ? { rating: { gte: minRating } } : {}),
      ...this._getYearFilter(yearFrom, yearTo)
    }
  }

  private _getSearchTermFilter(searchTerm?: string): Prisma.TitleWhereInput {
    return searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { originalName: { contains: searchTerm, mode: 'insensitive' } }
          ]
        }
      : {}
  }

  private _getYearFilter(
    yearFrom?: number,
    yearTo?: number
  ): Prisma.TitleWhereInput {
    if (!yearFrom && !yearTo) return {}

    return {
      releaseDate: {
        ...(yearFrom ? { gte: new Date(`${yearFrom}-01-01`) } : {}),
        ...(yearTo ? { lte: new Date(`${yearTo}-12-31`) } : {})
      }
    }
  }

  private _getOrderBy(
    sort?: TitleSortEnum
  ): Prisma.TitleOrderByWithRelationInput {
    if (sort === TitleSortEnum.Rating) return { rating: 'desc' }
    if (sort === TitleSortEnum.Newest) return { releaseDate: 'desc' }
    if (sort === TitleSortEnum.Name) return { name: 'asc' }

    // Популярное по умолчанию: число оценок честнее, чем сама оценка
    return { ratingCount: 'desc' }
  }
}
