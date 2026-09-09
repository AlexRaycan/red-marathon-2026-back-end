import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator'

export class CreateReviewDto {
  @IsString({ message: 'Invalid title id' })
  readonly titleId: string

  /** Оценки везде десятибалльные, клиент показывает их по своей шкале */
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 10' })
  @Max(10, { message: 'Rating must be between 1 and 10' })
  readonly rating: number

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Review is too short' })
  @MaxLength(5000, { message: 'Review is too long' })
  readonly text?: string

  @IsOptional()
  @IsBoolean()
  readonly isPublic?: boolean
}
