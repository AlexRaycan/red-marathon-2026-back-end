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
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { CreateReviewDto } from './dto/create-review.dto'
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
  @ApiOkResponse({ type: ReviewResponse })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto
  ): Promise<ReviewResponse> {
    return this.reviewService.create(userId, dto)
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
