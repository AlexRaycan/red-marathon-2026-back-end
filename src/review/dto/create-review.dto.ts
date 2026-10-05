import { IsString } from 'class-validator'

import { ReviewFieldsDto } from './review-fields.dto'

export class CreateReviewDto extends ReviewFieldsDto {
  @IsString({ message: 'Invalid title id' })
  readonly titleId: string
}
