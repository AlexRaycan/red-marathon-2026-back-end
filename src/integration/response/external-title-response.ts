import { ApiProperty } from '@nestjs/swagger'

import { ExternalSource, TitleType } from '../../generated/prisma/enums'

/** Результат поиска во внешнем API — ещё не сохранён у нас */
export class ExternalTitleResponse {
  key: string
  externalId: string
  externalSource: ExternalSource
  type: TitleType
  name: string
  originalName: string | null
  description: string | null
  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null
  releaseDate: Date | null
  rating: number | null
  ratingCount: number | null
  genres: string[]
}

export class ImportedTitleResponse {
  id: string
  slug: string
}
