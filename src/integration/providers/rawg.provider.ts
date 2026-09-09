import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  EXTERNAL_SEARCH_TAKE,
  RAWG_BASE_URL
} from '../../constants/integration.constants'
import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import {
  IExternalTitle,
  ITitleProvider
} from '../interfaces/title-provider.interface'

import { BaseProvider } from './base-provider'

/**
 * RAWG — игры. Ключ передаётся query-параметром `key`.
 * @see https://rawg.io/apidocs
 *
 * Пример элемента из /games:
 * {
 *   "id": 3328, "name": "The Witcher 3", "slug": "the-witcher-3",
 *   "released": "2015-05-18", "background_image": "https://...jpg",
 *   "rating": 4.66, "ratings_count": 6000, "metacritic": 92,
 *   "genres": [{ "name": "Action" }],
 *   "platforms": [{ "platform": { "name": "PC" } }]
 * }
 */
interface IRawgGame {
  id: number
  name: string
  description_raw?: string
  released?: string
  background_image?: string | null
  rating?: number
  ratings_count?: number
  metacritic?: number | null
  playtime?: number
  genres?: { name: string }[]
  platforms?: { platform: { name: string } }[]
  developers?: { name: string }[]
}

interface IRawgListResponse {
  results: IRawgGame[]
}

@Injectable()
export class RawgProvider extends BaseProvider implements ITitleProvider {
  readonly source = ExternalSource.RAWG
  readonly supportedTypes = [TitleType.GAME]

  constructor(private readonly configService: ConfigService) {
    super()
  }

  async search(query: string): Promise<IExternalTitle[]> {
    const data = await this.fetchJson<IRawgListResponse>(
      this._url('/games', {
        search: query,
        page_size: String(EXTERNAL_SEARCH_TAKE)
      })
    )

    return (data?.results ?? []).map(game => this._toExternalTitle(game))
  }

  async findByExternalId(externalId: string): Promise<IExternalTitle | null> {
    const game = await this.fetchJson<IRawgGame>(
      this._url(`/games/${externalId}`, {})
    )

    return game ? this._toExternalTitle(game) : null
  }

  private _toExternalTitle(game: IRawgGame): IExternalTitle {
    return {
      externalId: String(game.id),
      externalSource: this.source,
      type: TitleType.GAME,
      name: game.name,
      description: game.description_raw || undefined,
      coverUrl: game.background_image ?? undefined,
      releaseDate: this.toDate(game.released),
      // RAWG оценивает по 5-балльной шкале, у нас 10-балльная
      rating: game.rating ? game.rating * 2 : undefined,
      ratingCount: game.ratings_count,
      genres: (game.genres ?? []).map(({ name }) => name),
      // У игр «создатели» — студии-разработчики
      actors: (game.developers ?? []).map(({ name }) => ({ name })),
      metadata: {
        ...(game.metacritic ? { metacritic: game.metacritic } : {}),
        ...(game.playtime ? { averagePlaytimeHours: game.playtime } : {}),
        platforms: (game.platforms ?? []).map(({ platform }) => platform.name)
      }
    }
  }

  private _url(path: string, params: Record<string, string>): string {
    const search = new URLSearchParams({
      key: this.configService.get<string>('RAWG_API_KEY') ?? '',
      ...params
    })

    return `${RAWG_BASE_URL}${path}?${search}`
  }
}
