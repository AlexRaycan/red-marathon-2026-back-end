import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import {
  CreatorResponse,
  PersonResponse
} from '../../title/response/title-response'

/** Карточка тайтла из внешнего API — у нас в базе её может и не быть */
export class DiscoverItemResponse {
  /** Ключ для детальной страницы: `tmdb-movie-603`, `rawg-game-3328` */
  key: string
  externalId: string
  externalSource: ExternalSource
  type: TitleType
  name: string
  coverUrl: string | null
  releaseDate: Date | null
  rating: number | null
  genres: string[]
}

/** Детальная страница целиком из внешнего API */
export class DiscoverDetailsResponse extends DiscoverItemResponse {
  originalName: string | null
  description: string | null
  ratingCount: number | null
  /** PG-13, TV-MA, M, R-17+ — у каждого источника своя система */
  ageRating: string | null
  /** Актёры — только у фильмов и сериалов, у остальных пустой список */
  cast: PersonResponse[]
  /** Режиссёр, автор идеи сериала, студия игры или аниме, автор книги */
  creators: CreatorResponse[]
  /** Страницы книги, платформы игры, число серий */
  metadata: Record<string, unknown>
  /** «You may also like» — приходит вместе со страницей, отдельный запрос не нужен */
  similar: DiscoverItemResponse[]
}
