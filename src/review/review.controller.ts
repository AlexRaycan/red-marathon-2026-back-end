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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

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

  /** Отзывы по ключу витрины: `tmdb-movie-603`. Тайтла у нас нет — пустой список */
  @Get('discover/:key')
  @ApiOperation({ operationId: 'titleReviews' })
  @ApiOkResponse({ type: ReviewListResponse })
  findByDiscoverKey(
    @Param('key') key: string,
    @Query() query: ReviewQueryDto
  ): Promise<ReviewListResponse> {
    return this.reviewService.findByDiscoverKey(key, query)
  }

  @Get('my')
  @ApiOperation({ operationId: 'myReviews' })
  @Auth()
  @ApiOkResponse({ type: MyReviewListResponse })
  findMy(
    @CurrentUser('id') userId: string,
    @Query() query: ReviewQueryDto
  ): Promise<MyReviewListResponse> {
    return this.reviewService.findMy(userId, query)
  }

  /** Отзыв по ключу витрины — тайтл сохранится у нас вместе с отзывом */
  @Post('discover/:key')
  @ApiOperation({ operationId: 'createReview' })
  @Auth()
  @ApiCreatedResponse({ type: ReviewResponse })
  createByDiscoverKey(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
    @Body() dto: ReviewFieldsDto
  ): Promise<ReviewResponse> {
    return this.reviewService.createByDiscoverKey(userId, key, dto)
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateReview' })
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
  @ApiOperation({ operationId: 'deleteReview' })
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.reviewService.delete(userId, id)
  }
}
