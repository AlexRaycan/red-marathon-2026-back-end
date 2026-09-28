import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import { ActorResponse } from '../../title/response/title-response'

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
  /** Актёры у фильмов, студии у игр и аниме, авторы у книг */
  actors: ActorResponse[]
  /** Страницы книги, платформы игры, число серий */
  metadata: Record<string, unknown>
}
