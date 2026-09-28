import { Injectable } from '@nestjs/common'

import {
  EXTERNAL_SEARCH_TAKE,
  SHIKIMORI_GRAPHQL_URL,
  SHIKIMORI_USER_AGENT,
  TRENDING_TAKE_PER_SOURCE
} from '../../constants/integration.constants'
import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import {
  IExternalTitle,
  ITitleProvider
} from '../interfaces/title-provider.interface'

import { BaseProvider } from './base-provider'

/**
 * Shikimori — аниме. Ключ не нужен, но обязателен User-Agent,
 * иначе API отвечает 429.
 * @see https://shikimori.io/api/doc/graphql
 *
 * Берём GraphQL, а не REST: REST отдаёт постер максимум 225px,
 * а у части популярных тайтлов (Death Note) — заглушку вместо постера.
 *
 * Пример элемента из animes:
 * {
 *   "id": "52991", "name": "Sousou no Frieren",
 *   "russian": "Провожающая в последний путь Фрирен",
 *   "poster": { "main2xUrl": "https://shikimori.io/uploads/poster/animes/52991/main_2x-….webp" },
 *   "airedOn": { "date": "2023-09-29" }, "episodes": 28, "duration": 24,
 *   "score": 9.25, "kind": "tv", "status": "released",
 *   "genres": [{ "name": "Adventure" }], "studios": [{ "name": "Madhouse" }]
 * }
 */
interface IShikimoriAnime {
  id: string
  name: string
  russian: string | null
  description: string | null
  // main2xUrl — 450px webp: вдвое крупнее REST и легче оригинала (~700px, 370 КБ)
  poster: { main2xUrl: string } | null
  airedOn: { date: string | null } | null
  episodes: number
  duration: number | null
  score: number | null
  kind: string | null
  status: string | null
  genres: { name: string }[] | null
  studios: { name: string }[]
}

interface IShikimoriResponse {
  data?: { animes: IShikimoriAnime[] }
  errors?: { message: string }[]
}

interface IShikimoriVariables {
  search?: string
  ids?: string
  order?: 'popularity'
  season?: string
  limit?: number
}

const ANIMES_QUERY = `
  query (
    $search: String
    $ids: String
    $order: OrderEnum
    $season: SeasonString
    $limit: PositiveInt
  ) {
    animes(
      search: $search
      ids: $ids
      order: $order
      season: $season
      limit: $limit
    ) {
      id
      name
      russian
      description
      poster { main2xUrl }
      airedOn { date }
      episodes
      duration
      score
      kind
      status
      genres { name }
      studios { name }
    }
  }
`

@Injectable()
export class ShikimoriProvider extends BaseProvider implements ITitleProvider {
  readonly source = ExternalSource.SHIKIMORI
  readonly supportedTypes = [TitleType.ANIME]

  async search(query: string): Promise<IExternalTitle[]> {
    const items = await this._fetchAnimes({
      search: query,
      limit: EXTERNAL_SEARCH_TAKE
    })

    return items.map(anime => this._toExternalTitle(anime))
  }

  /** Популярное аниме прошлого и текущего года */
  async getTrending(): Promise<IExternalTitle[]> {
    const year = new Date().getFullYear()

    const items = await this._fetchAnimes({
      order: 'popularity',
      season: `${year - 1}_${year}`,
      limit: TRENDING_TAKE_PER_SOURCE
    })

    return items.map(anime => this._toExternalTitle(anime))
  }

  async findByExternalId(externalId: string): Promise<IExternalTitle | null> {
    const [anime] = await this._fetchAnimes({ ids: externalId })

    return anime ? this._toExternalTitle(anime) : null
  }

  private async _fetchAnimes(
    variables: IShikimoriVariables
  ): Promise<IShikimoriAnime[]> {
    const response = await this.postJson<IShikimoriResponse>(
      SHIKIMORI_GRAPHQL_URL,
      { query: ANIMES_QUERY, variables },
      { 'User-Agent': SHIKIMORI_USER_AGENT }
    )

    // GraphQL отвечает 200 даже на ошибку в запросе — она приходит в errors
    if (response?.errors) {
      this.logger.warn(
        `GraphQL: ${response.errors.map(({ message }) => message).join('; ')}`
      )
    }

    return response?.data?.animes ?? []
  }

  private _toExternalTitle(anime: IShikimoriAnime): IExternalTitle {
    return {
      externalId: anime.id,
      externalSource: this.source,
      type: TitleType.ANIME,
      // Продукт англоязычный: romaji-название основное, русское не используем
      name: anime.name,
      originalName: anime.russian ?? undefined,
      description: this._stripBbCode(anime.description),
      coverUrl: anime.poster?.main2xUrl,
      releaseDate: this.toDate(anime.airedOn?.date),
      // 0 у Shikimori значит «оценок нет», а не «худшая оценка»
      rating: anime.score || undefined,
      genres: (anime.genres ?? []).map(({ name }) => name),
      // У аниме «создатели» — студии
      actors: anime.studios.map(({ name }) => ({ name })),
      metadata: {
        ...(anime.episodes ? { episodes: anime.episodes } : {}),
        ...(anime.duration ? { episodeDurationMinutes: anime.duration } : {}),
        ...(anime.kind ? { kind: anime.kind } : {}),
        ...(anime.status ? { airingStatus: anime.status } : {})
      }
    }
  }

  /** Описания приходят с разметкой вида [character=123]…[/character] */
  private _stripBbCode(text: string | null): string | undefined {
    if (!text) return undefined

    return text.replace(/\[\/?[^\]]+\]/g, '').trim() || undefined
  }
}
