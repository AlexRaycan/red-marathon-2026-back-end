import { ExternalSource, TitleType } from '../../generated/prisma/enums'

/** Кем создатель приходится тайтлу — по роли фронт подписывает блок */
export const CreatorRoleEnum = {
  Director: 'DIRECTOR',
  Creator: 'CREATOR',
  Studio: 'STUDIO',
  Author: 'AUTHOR'
} as const

export type CreatorRoleEnum =
  (typeof CreatorRoleEnum)[keyof typeof CreatorRoleEnum]

export interface IExternalPerson {
  name: string
  photoUrl?: string
}

export interface IExternalCreator extends IExternalPerson {
  role: CreatorRoleEnum
}

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
  /** Короткая метка, как на постере или коробке: PG-13, TV-MA, M, R-17+ */
  ageRating?: string
  /** Актёры — есть только у фильмов и сериалов */
  cast?: IExternalPerson[]
  /** Режиссёр, автор идеи сериала, студия игры или аниме, автор книги */
  creators?: IExternalCreator[]
  /** Специфика типа: страницы книги, платформы игры, число серий */
  metadata?: Record<string, unknown>
}

/**
 * Детали для страницы тайтла. В базе не хранятся — берутся из внешнего
 * API при открытии, поэтому всегда свежие
 */
export interface ITitleDetails {
  description?: string
  ageRating?: string
  cast: IExternalPerson[]
  creators: IExternalCreator[]
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
  /** Популярное и свежее — для верхнего блока главной */
  getTrending(): Promise<IExternalTitle[]>
  findByExternalId(
    externalId: string,
    type?: TitleType
  ): Promise<IExternalTitle | null>
  /**
   * «You may also like» на детальной странице. Каждый источник считает
   * похожее по-своему, поэтому на вход — уже загруженный тайтл целиком
   */
  getSimilar(title: IExternalTitle): Promise<IExternalTitle[]>
}
