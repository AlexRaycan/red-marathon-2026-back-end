import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { isHasMorePagination } from '../utils/is-has-more-pagination'

import { CreateReviewDto } from './dto/create-review.dto'
import { ReviewQueryDto, ReviewSortEnum } from './dto/review-query.dto'
import { UpdateReviewDto } from './dto/update-review.dto'
import {
  MyReviewListResponse,
  ReviewListResponse,
  ReviewResponse
} from './response/review-response'

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

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

  /** Отзывы на тайтле — публичная страница, авторизация не нужна */
  async findByTitle(
    slug: string,
    query: ReviewQueryDto
  ): Promise<ReviewListResponse> {
    const title = await this.prisma.title.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!title) throw new NotFoundException('Title not found')

    const where: Prisma.ReviewWhereInput = {
      titleId: title.id,
      isPublic: true,
      // Пустой отзыв — это просто оценка, показывать его как отзыв незачем
      text: { not: null }
    }

    const [items, totalCount] = await Promise.all([
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
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take)
    }
  }

  async findMy(
    userId: string,
    query: ReviewQueryDto
  ): Promise<MyReviewListResponse> {
    const [items, totalCount] = await Promise.all([
      this.prisma.review.findMany({
        skip: query.skip,
        take: query.take,
        where: { userId },
        orderBy: this._getOrderBy(query.sort),
        select: {
          ...this.SELECT_REVIEW,
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
      }),
      this.prisma.review.count({ where: { userId } })
    ])

    return {
      items: items.map(({ title, ...item }) => ({
        ...this._toResponse(item),
        title
      })),
      isHasMore: isHasMorePagination(totalCount, query.skip, query.take)
    }
  }

  async create(userId: string, dto: CreateReviewDto): Promise<ReviewResponse> {
    const title = await this.prisma.title.findUnique({
      where: { id: dto.titleId },
      select: { id: true }
    })

    if (!title) throw new NotFoundException('Title not found')

    const existing = await this.prisma.review.findUnique({
      where: { userId_titleId: { userId, titleId: dto.titleId } },
      select: { id: true }
    })

    if (existing) {
      throw new BadRequestException('You have already reviewed this title')
    }

    const { titleId, ...rest } = dto

    // Отзыв и пересчёт рейтинга тайтла должны примениться вместе
    const review = await this.prisma.$transaction(async prisma => {
      const created = await prisma.review.create({
        data: { ...rest, userId, titleId },
        select: this.SELECT_REVIEW
      })

      await this._recalculateRating(prisma, titleId)

      return created
    })

    return this._toResponse(review)
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateReviewDto
  ): Promise<ReviewResponse> {
    const { titleId } = await this._findOwnReview(userId, id)

    const review = await this.prisma.$transaction(async prisma => {
      const updated = await prisma.review.update({
        where: { id },
        data: dto,
        select: this.SELECT_REVIEW
      })

      if (dto.rating !== undefined) {
        await this._recalculateRating(prisma, titleId)
      }

      return updated
    })

    return this._toResponse(review)
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { titleId } = await this._findOwnReview(userId, id)

    await this.prisma.$transaction(async prisma => {
      await prisma.review.delete({ where: { id } })

      await this._recalculateRating(prisma, titleId)
    })

    return true
  }

  // Приватные хелперы

  private async _findOwnReview(userId: string, id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, userId: true, titleId: true }
    })

    // Чужой отзыв отдаём как 404, чтобы не подтверждать его существование
    if (!review || review.userId !== userId) {
      throw new NotFoundException('Review not found')
    }

    return review
  }

  /**
   * Рейтинг тайтла — среднее по отзывам пользователей.
   * Пересчитываем внутри транзакции, чтобы он не разъехался с отзывами.
   */
  private async _recalculateRating(
    prisma: Prisma.TransactionClient,
    titleId: string
  ): Promise<void> {
    const [{ _avg }, ratingCount] = await Promise.all([
      prisma.review.aggregate({ where: { titleId }, _avg: { rating: true } }),
      prisma.review.count({ where: { titleId } })
    ])

    await prisma.title.update({
      where: { id: titleId },
      data: {
        rating: _avg.rating ? Number(_avg.rating.toFixed(2)) : 0,
        ratingCount
      }
    })
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
