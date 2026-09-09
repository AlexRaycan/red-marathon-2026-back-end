import { ExternalSource, TitleType } from '../../generated/prisma/enums'

/** Результат поиска во внешнем API — ещё не сохранён у нас */
export class ExternalTitleResponse {
  externalId: string
  externalSource: ExternalSource
  type: TitleType
  name: string
  originalName?: string
  description?: string
  coverUrl?: string
  releaseDate?: Date
  rating?: number
  ratingCount?: number
  genres: string[]
}

export class ImportedTitleResponse {
  id: string
  slug: string
}
