import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { CreateReviewDto } from './dto/create-review.dto'
import { ReviewFieldsDto } from './dto/review-fields.dto'
import { ReviewQueryDto } from './dto/review-query.dto'
import { UpdateReviewDto } from './dto/update-review.dto'
import {
  MyReviewListResponse,
  ReviewListResponse,
  ReviewResponse
} from './response/review-response'
import { ReviewService } from './review.service'

@ApiTags('reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /** Отзывы на тайтле — открыты без авторизации */
  @Get('title/:slug')
  @ApiOkResponse({ type: ReviewListResponse })
  findByTitle(
    @Param('slug') slug: string,
    @Query() query: ReviewQueryDto
  ): Promise<ReviewListResponse> {
    return this.reviewService.findByTitle(slug, query)
  }

  /** Отзывы по ключу витрины: `tmdb-movie-603`. Тайтла у нас нет — пустой список */
  @Get('discover/:key')
  @ApiOkResponse({ type: ReviewListResponse })
  findByDiscoverKey(
    @Param('key') key: string,
    @Query() query: ReviewQueryDto
  ): Promise<ReviewListResponse> {
    return this.reviewService.findByDiscoverKey(key, query)
  }

  @Get('my')
  @Auth()
  @ApiOkResponse({ type: MyReviewListResponse })
  findMy(
    @CurrentUser('id') userId: string,
    @Query() query: ReviewQueryDto
  ): Promise<MyReviewListResponse> {
    return this.reviewService.findMy(userId, query)
  }

  @Post()
  @Auth()
  @ApiCreatedResponse({ type: ReviewResponse })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto
  ): Promise<ReviewResponse> {
    return this.reviewService.create(userId, { titleId: dto.titleId }, dto)
  }

  /** Отзыв по ключу витрины — тайтл сохранится у нас вместе с отзывом */
  @Post('discover/:key')
  @Auth()
  @ApiCreatedResponse({ type: ReviewResponse })
  createByDiscoverKey(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
    @Body() dto: ReviewFieldsDto
  ): Promise<ReviewResponse> {
    return this.reviewService.create(userId, { key }, dto)
  }

  @Patch(':id')
  @Auth()
  @ApiOkResponse({ type: ReviewResponse })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto
  ): Promise<ReviewResponse> {
    return this.reviewService.update(userId, id, dto)
  }

  @Delete(':id')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.reviewService.delete(userId, id)
  }
}
