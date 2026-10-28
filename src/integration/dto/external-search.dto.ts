import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator'

import { GENRE_SLUGS } from '../../constants/genres.constants'
import {
  EXTERNAL_MAX_YEAR,
  EXTERNAL_MIN_YEAR
} from '../../constants/integration.constants'
import { TitleType } from '../../generated/prisma/enums'

export class ExternalSearchDto {
  @IsString()
  @MinLength(2, { message: 'Query must be at least 2 characters' })
  readonly q: string

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(TitleType, { each: true, message: 'Unknown title type' })
  readonly type?: TitleType[]

  /** slug из GET /external/genres; подходит тайтл с любым из жанров */
  @IsOptional()
  @ApiPropertyOptional({
    enum: GENRE_SLUGS,
    enumName: 'GenreSlug',
    isArray: true
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsIn(GENRE_SLUGS, { each: true, message: 'Unknown genre' })
  readonly genre?: string[]

  /** Год выхода, от (включительно) */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  @Min(EXTERNAL_MIN_YEAR, { message: 'Year is too early' })
  @Max(EXTERNAL_MAX_YEAR, { message: 'Year is too far in the future' })
  readonly yearFrom?: number

  /** Год выхода, до (включительно) */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  @Min(EXTERNAL_MIN_YEAR, { message: 'Year is too early' })
  @Max(EXTERNAL_MAX_YEAR, { message: 'Year is too far in the future' })
  readonly yearTo?: number
}
