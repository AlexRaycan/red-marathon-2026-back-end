import { Transform } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator'

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
}
