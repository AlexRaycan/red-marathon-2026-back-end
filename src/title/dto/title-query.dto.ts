import { Transform, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'

import { PaginationQueryDto } from '../../base/pagination-query.dto'
import { TitleType } from '../../generated/prisma/enums'

export const TitleSortEnum = {
  Popular: 'popular',
  Rating: 'rating',
  Newest: 'newest',
  Name: 'name'
} as const

export type TitleSortEnum = (typeof TitleSortEnum)[keyof typeof TitleSortEnum]

export class TitleQueryDto extends PaginationQueryDto {
  /** Несколько типов сразу: ?type=MOVIE&type=GAME */
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(TitleType, { each: true, message: 'Unknown title type' })
  readonly type?: TitleType[]

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  readonly genres?: string[]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  readonly minRating?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly yearFrom?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly yearTo?: number

  @IsOptional()
  @IsEnum(TitleSortEnum, { message: 'Unknown sort option' })
  readonly sort?: TitleSortEnum = TitleSortEnum.Popular
}
