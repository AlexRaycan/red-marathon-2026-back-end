import { PartialType } from '@nestjs/swagger'

import { ReviewFieldsDto } from './review-fields.dto'

/**
 * skipNullProperties: false — поле можно не прислать, но null проходит
 * только там, где он явно разрешён (text)
 */
export class UpdateReviewDto extends PartialType(ReviewFieldsDto, {
  skipNullProperties: false
}) {}
