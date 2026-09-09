import { ExternalSource, TitleType } from '../../generated/prisma/enums'

/** Единый формат, в который каждый провайдер приводит свой ответ */
export interface IExternalTitle {
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
  /** Актёры у фильмов, студии у игр и аниме, авторы у книг */
  actors?: { name: string; photoUrl?: string }[]
  /** Специфика типа: страницы книги, платформы игры, число серий */
  metadata?: Record<string, unknown>
}

/**
 * Детали для страницы тайтла. В базе не хранятся — берутся из внешнего
 * API при открытии, поэтому всегда свежие
 */
export interface ITitleDetails {
  description?: string
  actors: { name: string; photoUrl?: string }[]
  metadata: Record<string, unknown>
}

/**
 * Каждая внешняя интеграция реализует этот интерфейс.
 * Доменный сервис не знает, из какого API пришли данные.
 */
export interface ITitleProvider {
  readonly source: ExternalSource
  /** Какие типы тайтлов умеет отдавать — по ним роутится поиск */
  readonly supportedTypes: TitleType[]

  search(query: string): Promise<IExternalTitle[]>
  findByExternalId(
    externalId: string,
    type?: TitleType
  ): Promise<IExternalTitle | null>
}
