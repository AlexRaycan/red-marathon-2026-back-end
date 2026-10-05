import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from 'class-validator'

/** Поля отзыва без привязки к тайтлу: тайтл задаётся id или ключом витрины */
export class ReviewFieldsDto {
  /** Оценки везде десятибалльные, клиент показывает их по своей шкале */
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 10' })
  @Max(10, { message: 'Rating must be between 1 and 10' })
  readonly rating: number

  /** null очищает текст — отзыв становится просто оценкой */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Review is too short' })
  @MaxLength(5000, { message: 'Review is too long' })
  readonly text?: string

  // Не IsOptional: он пропускает и null, а в базе поле обязательное
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  readonly isPublic?: boolean
}
