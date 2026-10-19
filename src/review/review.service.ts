import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { PRISMA_UNIQUE_VIOLATION } from '../constants/app.constants'
import { Prisma } from '../generated/prisma/client'
import { IntegrationService } from '../integration/integration.service'
import { PrismaService } from '../prisma/prisma.service'
import {
  TITLE_LIST_ITEM_SELECT,
  toTitleListItemResponse
} from '../title/title-list-item'
import { parseDiscoverKey } from '../utils/discover-key'
import { isHasMorePagination } from '../utils/is-has-more-pagination'

import { ReviewFieldsDto } from './dto/review-fields.dto'
import { ReviewQueryDto, ReviewSortEnum } from './dto/review-query.dto'
import { UpdateReviewDto } from './dto/update-review.dto'
import {
  MyReviewListResponse,
  ReviewListResponse,
  ReviewResponse
} from './response/review-response'

@Injectable()
export class ReviewService {
  constructor(
    private prisma: PrismaService,
    private readonly integrationService: IntegrationService
  ) {}

  private SELECT_REVIEW = {
    id: true,
    rating: true,
    text: true,
    isPublic: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        username: true,
        profile: { select: { displayName: true, avatarUrl: true } }
      }
    }
  }

  /** Отзывы для детальной страницы витрины — тайтла у нас может ещё не быть */
  async findByDiscoverKey(
    key: string,
    query: ReviewQueryDto
  ): Promise<ReviewListResponse> {
    const { source, type, externalId } = parseDiscoverKey(key)

    const title = await this.integrationService.findImported(
      source,
      externalId,
      type
    )

    // Тайтл, который ещё никто не сохранял, — обычный тайтл без отзывов
    if (!title) return { items: [], isHasMore: false, total: 0 }

    return this._findPublicByTitle(title.id, query)
  }

  /** Свой отзыв — включая приватный и без текста */
  async findMineByTitle(
    userId: string,
    titleId: string
  ): Promise<ReviewResponse | null> {
    const review = await this.prisma.review.findUnique({
      where: { userId_titleId: { userId, titleId } },
      select: this.SELECT_REVIEW
    })

    return review ? this._toResponse(review) : null
  }

  async findMy(
    userId: string,
    query: ReviewQueryDto
  ): Promise<MyReviewListResponse> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        skip: query.skip,
        take: query.take,
        where: { userId },
        orderBy: this._getOrderBy(query.sort),
        select: {
          ...this.SELECT_REVIEW,
          title: { select: TITLE_LIST_ITEM_SELECT }
        }
      }),
      this.prisma.review.count({ where: { userId } })
    ])

    return {
      items: items.map(({ title, ...item }) => ({
        ...this._toResponse(item),
        title: toTitleListItemResponse(title)
      })),
      isHasMore: isHasMorePagination(total, query.skip, query.take),
      total
    }
  }

  /**
   * Тайтл по ключу витрины импортируется здесь же: импорт и отзыв
   * применяются вместе или не применяются вовсе
   */
  async createByDiscoverKey(
    userId: string,
    key: string,
    dto: ReviewFieldsDto
  ): Promise<ReviewResponse> {
    const { source, type, externalId } = parseDiscoverKey(key)

    const saveTitle = await this.integrationService.prepareImport(
      source,
      externalId,
      type
    )

    const review = await this.prisma.$transaction(async prisma => {
      const { id: titleId } = await saveTitle(prisma)

      return this._insertReview(prisma, {
        rating: dto.rating,
        text: dto.text,
        isPublic: dto.isPublic,
        userId,
        titleId
      })
    })

    return this._toResponse(review)
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateReviewDto
  ): Promise<ReviewResponse> {
    await this._ensureIsOwner(userId, id)

    const review = await this.prisma.review.update({
      where: { id },
      data: dto,
      select: this.SELECT_REVIEW
    })

    return this._toResponse(review)
  }

  async delete(userId: string, id: string): Promise<boolean> {
    await this._ensureIsOwner(userId, id)

    await this.prisma.review.delete({ where: { id } })

    return true
  }

  // Приватные хелперы

  private async _findPublicByTitle(
    titleId: string,
    query: ReviewQueryDto
  ): Promise<ReviewListResponse> {
    const where: Prisma.ReviewWhereInput = {
      titleId,
      isPublic: true,
      // Пустой отзыв — это просто оценка, показывать его как отзыв незачем
      text: { not: null }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        skip: query.skip,
        take: query.take,
        where,
        orderBy: this._getOrderBy(query.sort),
        select: this.SELECT_REVIEW
      }),
      this.prisma.review.count({ where })
    ])

    return {
      items: items.map(item => this._toResponse(item)),
      isHasMore: isHasMorePagination(total, query.skip, query.take),
      total
    }
  }

  /**
   * Повторный отзыв ловим уникальным индексом, а не проверкой заранее:
   * так и параллельный запрос получает 409, а не 500
   */
  private async _insertReview(
    prisma: Prisma.TransactionClient,
    data: Prisma.ReviewUncheckedCreateInput
  ) {
    try {
      return await prisma.review.create({ data, select: this.SELECT_REVIEW })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === PRISMA_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('You have already reviewed this title')
      }

      throw e
    }
  }

  private async _ensureIsOwner(userId: string, id: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { userId: true }
    })

    // Чужой отзыв отдаём как 404, чтобы не подтверждать его существование
    if (!review || review.userId !== userId) {
      throw new NotFoundException('Review not found')
    }
  }

  private _toResponse(review: {
    user: {
      username: string
      profile: { displayName: string | null; avatarUrl: string | null } | null
    }
    [key: string]: unknown
  }): ReviewResponse {
    const { user, ...rest } = review

    return {
      ...rest,
      author: {
        username: user.username,
        displayName: user.profile?.displayName ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null
      }
    } as ReviewResponse
  }

  private _getOrderBy(
    sort?: ReviewSortEnum
  ): Prisma.ReviewOrderByWithRelationInput {
    if (sort === ReviewSortEnum.Rating) return { rating: 'desc' }
    if (sort === ReviewSortEnum.RatingAsc) return { rating: 'asc' }

    return { createdAt: 'desc' }
  }
}
