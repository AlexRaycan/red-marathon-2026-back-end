import { ApiProperty } from '@nestjs/swagger'

import { TitleType } from '../../generated/prisma/enums'
import { CreatorRoleEnum } from '../../integration/interfaces/title-provider.interface'

/** Приходит из внешнего API, у нас не хранится */
export class PersonResponse {
  name: string
  photoUrl: string | null
}

export class CreatorResponse extends PersonResponse {
  // as const плагин Swagger не разбирает — без этого orval выдаст string
  @ApiProperty({ enum: CreatorRoleEnum, enumName: 'CreatorRole' })
  role: CreatorRoleEnum
}

/** Карточка в списке — без тяжёлых полей */
export class TitleListItemResponse {
  id: string
  /** Ключ витрины; null только у тайтла без внешнего источника */
  key: string | null
  type: TitleType
  name: string
  slug: string
  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null
  releaseDate: Date | null
  rating: number
  ratingCount: number
}
