import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

import {
  DISCOVER_DEFAULT_TAKE,
  DISCOVER_MAX_TAKE
} from '../../constants/integration.constants'

export class DiscoverQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DISCOVER_MAX_TAKE, {
    message: `Maximum ${DISCOVER_MAX_TAKE} items per request`
  })
  readonly take?: number = DISCOVER_DEFAULT_TAKE
}
