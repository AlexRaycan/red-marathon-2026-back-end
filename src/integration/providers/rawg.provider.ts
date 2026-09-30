import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SIMILAR_TAKE } from '../../constants/app.constants'
import {
  EXTERNAL_SEARCH_TAKE,
  RAWG_BASE_URL,
  TRENDING_TAKE_PER_SOURCE
} from '../../constants/integration.constants'
import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import {
  CreatorRoleEnum,
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
  developers?: { id: number; name: string }[]
  esrb_rating?: { slug: string } | null
}

// Короткие метки ESRB, как на коробках. rating-pending сюда не входит —
// «рейтинг ещё не присвоен» для юзера то же, что его отсутствие
const ESRB_LABELS: Record<string, string> = {
  everyone: 'E',
  'everyone-10-plus': 'E10+',
  teen: 'T',
  mature: 'M',
  'adults-only': 'AO'
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

  /** Самые добавляемые игры, вышедшие за последние полгода */
  async getTrending(): Promise<IExternalTitle[]> {
    const to = new Date()
    const from = new Date()
    from.setMonth(from.getMonth() - 6)

    const data = await this.fetchJson<IRawgListResponse>(
      this._url('/games', {
        dates: `${this._formatDate(from)},${this._formatDate(to)}`,
        ordering: '-added',
        page_size: String(TRENDING_TAKE_PER_SOURCE)
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

  /**
   * Сначала игры той же серии, затем — той же студии: как «тот же автор»
   * у книг. У одиночной игры серии нет, а студия есть почти всегда.
   * Настоящие «похожие» у RAWG (/suggested) — только на платном тарифе,
   * а подбор по жанру выдаёт одни и те же хиты для любой игры
   */
  async getSimilar(title: IExternalTitle): Promise<IExternalTitle[]> {
    const [series, byDevelopers] = await Promise.all([
      this.fetchJson<IRawgListResponse>(
        this._url(`/games/${title.externalId}/game-series`, {
          page_size: String(SIMILAR_TAKE)
        })
      ),
      this._getGamesByDevelopers(title.externalId)
    ])

    // Игра серии часто сделана той же студией — не показываем её дважды
    const seenIds = new Set([title.externalId])

    return [...(series?.results ?? []), ...byDevelopers]
      .filter(({ id }) => {
        if (seenIds.has(String(id))) return false

        seenIds.add(String(id))

        return true
      })
      .slice(0, SIMILAR_TAKE)
      .map(game => this._toExternalTitle(game))
  }

  // Приватные хелперы

  /**
   * В тайтле студии лежат только именами, а фильтр /games принимает id —
   * поэтому ещё раз берём детали игры. Ответ целиком кешируется на час
   */
  private async _getGamesByDevelopers(
    externalId: string
  ): Promise<IRawgGame[]> {
    const game = await this.fetchJson<IRawgGame>(
      this._url(`/games/${externalId}`, {})
    )

    const developerIds = (game?.developers ?? []).map(({ id }) => id)

    if (!developerIds.length) return []

    const data = await this.fetchJson<IRawgListResponse>(
      this._url('/games', {
        developers: developerIds.join(','),
        // Самое популярное первым, без DLC и дополнений
        ordering: '-added',
        exclude_additions: 'true',
        page_size: String(SIMILAR_TAKE)
      })
    )

    return data?.results ?? []
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
      ageRating: game.esrb_rating
        ? ESRB_LABELS[game.esrb_rating.slug]
        : undefined,
      // Актёров озвучки RAWG не отдаёт — только студии
      creators: (game.developers ?? []).map(({ name }) => ({
        name,
        role: CreatorRoleEnum.Studio
      })),
      metadata: {
        ...(game.metacritic ? { metacritic: game.metacritic } : {}),
        ...(game.playtime ? { averagePlaytimeHours: game.playtime } : {}),
        platforms: (game.platforms ?? []).map(({ platform }) => platform.name)
      }
    }
  }

  /** RAWG принимает даты в формате YYYY-MM-DD */
  private _formatDate(date: Date): string {
    return date.toISOString().slice(0, 10)
  }

  private _url(path: string, params: Record<string, string>): string {
    const search = new URLSearchParams({
      key: this.configService.get<string>('RAWG_API_KEY') ?? '',
      ...params
    })

    return `${RAWG_BASE_URL}${path}?${search}`
  }
}
