import { OmitType, PartialType } from '@nestjs/swagger'

import { CreateReviewDto } from './create-review.dto'

/** titleId менять нельзя — это отзыв на другой тайтл */
export class UpdateReviewDto extends PartialType(
  OmitType(CreateReviewDto, ['titleId'] as const)
) {}
