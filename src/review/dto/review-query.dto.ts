import { IsEnum, IsOptional } from 'class-validator'

import { PaginationQueryDto } from '../../base/pagination-query.dto'

export const ReviewSortEnum = {
  Newest: 'newest',
  Rating: 'rating',
  RatingAsc: 'ratingAsc'
} as const

export type ReviewSortEnum =
  (typeof ReviewSortEnum)[keyof typeof ReviewSortEnum]

export class ReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReviewSortEnum, { message: 'Unknown sort option' })
  readonly sort?: ReviewSortEnum = ReviewSortEnum.Newest
}
