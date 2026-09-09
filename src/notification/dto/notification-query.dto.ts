import { IsBooleanString, IsOptional } from 'class-validator'

import { PaginationQueryDto } from '../../base/pagination-query.dto'

export class NotificationQueryDto extends PaginationQueryDto {
  /** Только непрочитанные — для колокольчика */
  @IsOptional()
  @IsBooleanString()
  readonly isUnread?: string
}
