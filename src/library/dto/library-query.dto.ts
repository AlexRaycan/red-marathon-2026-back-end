import { Transform } from 'class-transformer'
import { IsArray, IsBooleanString, IsEnum, IsOptional } from 'class-validator'

import { PaginationQueryDto } from '../../base/pagination-query.dto'
import { LibraryStatus, TitleType } from '../../generated/prisma/enums'

export const LibrarySortEnum = {
  Recent: 'recent',
  Rating: 'rating',
  Name: 'name'
} as const

export type LibrarySortEnum =
  (typeof LibrarySortEnum)[keyof typeof LibrarySortEnum]

export class LibraryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(LibraryStatus, { each: true, message: 'Unknown status' })
  readonly status?: LibraryStatus[]

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(TitleType, { each: true, message: 'Unknown title type' })
  readonly type?: TitleType[]

  @IsOptional()
  @IsBooleanString()
  readonly isFavorite?: string

  @IsOptional()
  @IsEnum(LibrarySortEnum, { message: 'Unknown sort option' })
  readonly sort?: LibrarySortEnum = LibrarySortEnum.Recent
}
