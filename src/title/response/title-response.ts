import { ApiProperty } from '@nestjs/swagger'

import { TitleStatus, TitleType } from '../../generated/prisma/enums'
import { CreatorRoleEnum } from '../../integration/interfaces/title-provider.interface'

export class GenreResponse {
  id: string
  name: string
  slug: string
}

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
  type: TitleType
  name: string
  slug: string
  coverUrl: string | null
  releaseDate: Date | null
  rating: number
  ratingCount: number
}

export class TitleListResponse {
  items: TitleListItemResponse[]
  isHasMore: boolean
}

/** Детальная страница: наши данные плюс детали из внешнего API */
export class TitleResponse extends TitleListItemResponse {
  status: TitleStatus
  originalName: string | null
  genres: GenreResponse[]
  /** Похожие тайтлы — приходят вместе со страницей, отдельный запрос не нужен */
  similar: TitleListItemResponse[]
  createdAt: Date

  /** Ниже — из внешнего API, в нашей базе не хранится */
  description: string | null
  /** PG-13, TV-MA, M, R-17+ — у каждого источника своя система */
  ageRating: string | null
  /** Актёры — только у фильмов и сериалов, у остальных пустой список */
  cast: PersonResponse[]
  /** Режиссёр, автор идеи сериала, студия игры или аниме, автор книги */
  creators: CreatorResponse[]
  /** Страницы книги, платформы игры, число серий */
  metadata: Record<string, unknown>
}
