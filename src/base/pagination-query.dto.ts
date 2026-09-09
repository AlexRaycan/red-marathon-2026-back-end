import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

import { DEFAULT_TAKE, MAX_TAKE } from '../constants/app.constants'

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly skip?: number = 0

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TAKE, { message: `Maximum ${MAX_TAKE} items per request` })
  readonly take?: number = DEFAULT_TAKE

  @IsOptional()
  @IsString()
  readonly searchTerm?: string
}
