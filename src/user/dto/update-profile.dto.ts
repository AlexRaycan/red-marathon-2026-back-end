import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator'

import { RatingScale } from '../../generated/prisma/enums'

export class UpdateProfileDto {
  /** При регистрации выдаётся случайный — здесь юзер меняет его на свой */
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username is too long' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may contain only letters, digits and underscore'
  })
  readonly username?: string

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Name is too long' })
  readonly displayName?: string

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description is too long' })
  readonly bio?: string

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'URL is too long' })
  readonly avatarUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Country name is too long' })
  readonly country?: string

  @IsOptional()
  @IsDateString({}, { message: 'Invalid birth date' })
  readonly birthDate?: string

  /** Открыт ли Taste DNA по публичной ссылке */
  @IsOptional()
  @IsBoolean()
  readonly isPublic?: boolean

  /**
   * Предпочтительная шкала отображения. На бэкенде оценки всегда
   * десятибалльные — фронт делит на 2, когда выбрана пятибалльная
   */
  @IsOptional()
  @IsEnum(RatingScale, { message: 'Unknown rating scale' })
  readonly ratingScale?: RatingScale
}
