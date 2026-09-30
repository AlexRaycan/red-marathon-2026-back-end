import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Cache } from 'cache-manager'

import { SIMILAR_TAKE } from '../constants/app.constants'
import {
  TITLE_DETAILS_CACHE_TTL_MS,
  TRENDING_CACHE_TTL_MS
} from '../constants/integration.constants'
import { ExternalSource, TitleType } from '../generated/prisma/enums'
import {
  IExternalTitle,
  ITitleProvider
} from '../integration/interfaces/title-provider.interface'
import { GoogleBooksProvider } from '../integration/providers/google-books.provider'
import { RawgProvider } from '../integration/providers/rawg.provider'
import { ShikimoriProvider } from '../integration/providers/shikimori.provider'
import { TmdbProvider } from '../integration/providers/tmdb.provider'
import { toPersonResponse } from '../utils/to-person-response'

import {
  DiscoverDetailsResponse,
  DiscoverItemResponse
} from './response/discover-response'

// Порядок, в котором типы чередуются в подборке главной
const TYPES_ORDER: TitleType[] = [
  TitleType.MOVIE,
  TitleType.TV_SHOW,
  TitleType.GAME,
  TitleType.ANIME,
  TitleType.BOOK
]

/**
 * Витрина: главная и детальная страница прямо из внешних API.
 * В нашу базу ничего не пишет — тайтл сохраняется у нас, только когда
 * юзер добавляет его в библиотеку, коллекцию или пишет отзыв.
 */
@Injectable()
export class DiscoverService {
  private readonly providers: ITitleProvider[]

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    tmdb: TmdbProvider,
    rawg: RawgProvider,
    googleBooks: GoogleBooksProvider,
    shikimori: ShikimoriProvider
  ) {
    this.providers = [tmdb, rawg, googleBooks, shikimori]
  }

  /** Свежее и популярное из всех источников, вперемешку по типам */
  async getTrending(take: number): Promise<DiscoverItemResponse[]> {
    const results = await Promise.all(
      this.providers.map(provider => this._getTrendingFrom(provider))
    )

    return this._interleaveByType(results.flat())
      .slice(0, take)
      .map(item => this._toItem(item))
  }

  async findByKey(key: string): Promise<DiscoverDetailsResponse> {
    const cacheKey = `discover:details:${key}`

    const cached = await this.cache.get<DiscoverDetailsResponse>(cacheKey)

    if (cached) return cached

    const { source, type, externalId } = this._parseKey(key)

    const provider = this.providers.find(
      provider =>
        provider.source === source && provider.supportedTypes.includes(type)
    )

    if (!provider) throw new NotFoundException('Title not found')

    const external = await provider.findByExternalId(externalId, type)

    if (!external) throw new NotFoundException('Title not found')

    // Недоступный источник вернёт пустой список — страница не ломается
    const similar = await provider.getSimilar(external)
    const ownKey = this._toKey(external)

    const details: DiscoverDetailsResponse = {
      ...this._toItem(external),
      originalName: external.originalName ?? null,
      description: external.description ?? null,
      ratingCount: external.ratingCount ?? null,
      ageRating: external.ageRating ?? null,
      cast: (external.cast ?? []).map(toPersonResponse),
      creators: (external.creators ?? []).map(toPersonResponse),
      metadata: external.metadata ?? {},
      similar: similar
        .map(item => this._toItem(item))
        .filter(item => item.key !== ownKey)
        .slice(0, SIMILAR_TAKE)
    }

    await this.cache.set(cacheKey, details, TITLE_DETAILS_CACHE_TTL_MS)

    return details
  }

  // Приватные хелперы

  /**
   * Кеш — на каждый источник отдельно: если RAWG лежит, фильмы
   * и книги всё равно берутся из кеша, а RAWG попробуем в следующий раз
   */
  private async _getTrendingFrom(
    provider: ITitleProvider
  ): Promise<IExternalTitle[]> {
    const cacheKey = `discover:trending:${provider.source}`

    const cached = await this.cache.get<IExternalTitle[]>(cacheKey)

    if (cached) return cached

    const items = await provider.getTrending()

    // Пустую выдачу не кешируем: скорее всего источник недоступен
    if (items.length) {
      await this.cache.set(cacheKey, items, TRENDING_CACHE_TTL_MS)
    }

    return items
  }

  /**
   * Чередуем типы по кругу: фильм, сериал, игра, аниме, книга, фильм…
   * Так в первых карточках всегда есть всё, а не 20 фильмов подряд.
   * Внутри типа порядок источника сохраняется — самое популярное первым
   */
  private _interleaveByType(items: IExternalTitle[]): IExternalTitle[] {
    const groups = TYPES_ORDER.map(type =>
      items.filter(item => item.type === type)
    )

    const maxLength = Math.max(0, ...groups.map(group => group.length))

    const result: IExternalTitle[] = []

    for (let i = 0; i < maxLength; i++) {
      groups.forEach(group => {
        if (group[i]) result.push(group[i])
      })
    }

    return result
  }

  private _toItem(item: IExternalTitle): DiscoverItemResponse {
    return {
      key: this._toKey(item),
      externalId: item.externalId,
      externalSource: item.externalSource,
      type: item.type,
      name: item.name,
      coverUrl: item.coverUrl ?? null,
      releaseDate: item.releaseDate ?? null,
      rating: item.rating ?? null,
      genres: item.genres
    }
  }

  /**
   * Ключ собирает всё, что нужно, чтобы найти тайтл во внешнем API:
   * источник, тип (TMDB хранит фильмы и сериалы раздельно) и внешний id.
   * Регистр меняем только у источника и типа: id книг Google
   * регистрозависимый — `XdMbTkWsFeMC` в нижнем регистре даёт 404
   */
  private _toKey(item: IExternalTitle): string {
    const prefix = `${item.externalSource}-${item.type}`.toLowerCase()

    return `${prefix}-${item.externalId}`
  }

  /**
   * В источнике и типе дефисов нет, а в id книг Google бывают —
   * поэтому всё после второго дефиса считаем id
   */
  private _parseKey(key: string): {
    source: ExternalSource
    type: TitleType
    externalId: string
  } {
    const [rawSource = '', rawType = '', ...rest] = key.split('-')

    const source = rawSource.toUpperCase()
    const type = rawType.toUpperCase()
    const externalId = rest.join('-')

    const isValid =
      (Object.values(ExternalSource) as string[]).includes(source) &&
      (Object.values(TitleType) as string[]).includes(type) &&
      Boolean(externalId)

    if (!isValid) throw new NotFoundException('Title not found')

    return {
      source: source as ExternalSource,
      type: type as TitleType,
      externalId
    }
  }
}
