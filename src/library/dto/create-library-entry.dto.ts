import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator'

import { LibraryStatus, ProgressUnit } from '../../generated/prisma/enums'

export class CreateLibraryEntryDto {
  @IsString({ message: 'Invalid title id' })
  readonly titleId: string

  @IsOptional()
  @IsEnum(LibraryStatus, { message: 'Unknown status' })
  readonly status?: LibraryStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly progress?: number

  @IsOptional()
  @IsEnum(ProgressUnit, { message: 'Unknown progress unit' })
  readonly progressUnit?: ProgressUnit

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 10' })
  @Max(10, { message: 'Rating must be between 1 and 10' })
  readonly rating?: number

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Note is too long' })
  readonly note?: string

  @IsOptional()
  @IsBoolean()
  readonly isFavorite?: boolean

  /** Если не прислать — проставится автоматически по статусу */
  @IsOptional()
  @IsDateString({}, { message: 'Invalid start date' })
  readonly startedAt?: string

  @IsOptional()
  @IsDateString({}, { message: 'Invalid finish date' })
  readonly finishedAt?: string
}
