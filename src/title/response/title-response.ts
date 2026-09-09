import { TitleStatus, TitleType } from '../../generated/prisma/enums'

export class GenreResponse {
  id: string
  name: string
  slug: string
}

/** Приходит из внешнего API, у нас не хранится */
export class ActorResponse {
  name: string
  photoUrl: string | null
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
  /** Актёры у фильмов, студии у игр и аниме, авторы у книг */
  actors: ActorResponse[]
  /** Страницы книги, платформы игры, число серий */
  metadata: Record<string, unknown>
}
