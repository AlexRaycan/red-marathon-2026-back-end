import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  EXTERNAL_SEARCH_TAKE,
  TMDB_BASE_URL,
  TMDB_CAST_LIMIT,
  TMDB_IMAGE_URL
} from '../../constants/integration.constants'
import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import {
  IExternalTitle,
  ITitleProvider
} from '../interfaces/title-provider.interface'

import { BaseProvider } from './base-provider'

/**
 * TMDB — фильмы и сериалы.
 * @see https://developer.themoviedb.org/reference/search-multi
 *
 * Пример элемента из search/multi:
 * {
 *   "id": 49051, "media_type": "movie", "title": "Хоббит",
 *   "original_title": "The Hobbit", "overview": "...",
 *   "poster_path": "/abc.jpg", "release_date": "2012-11-26",
 *   "vote_average": 7.3, "vote_count": 17000, "genre_ids": [12, 14]
 * }
 * У сериалов вместо title/release_date — name/first_air_date.
 */
interface ITmdbItem {
  id: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  vote_count?: number
  genre_ids?: number[]
  genres?: { id: number; name: string }[]
  number_of_seasons?: number
  number_of_episodes?: number
  runtime?: number
  credits?: { cast?: ITmdbCastMember[] }
}

/** Актёры приходят только в деталях тайтла, в поиске их нет */
interface ITmdbCastMember {
  name?: string
  profile_path?: string | null
  order?: number
}

interface ITmdbSearchResponse {
  results: ITmdbItem[]
}

interface ITmdbGenresResponse {
  genres: { id: number; name: string }[]
}

@Injectable()
export class TmdbProvider extends BaseProvider implements ITitleProvider {
  readonly source = ExternalSource.TMDB
  readonly supportedTypes = [TitleType.MOVIE, TitleType.TV_SHOW]

  // Жанры приходят числами — словарь тянем один раз и держим в памяти
  private genresCache: Map<number, string> | null = null

  constructor(private readonly configService: ConfigService) {
    super()
  }

  async search(query: string): Promise<IExternalTitle[]> {
    const data = await this.fetchJson<ITmdbSearchResponse>(
      this._url('/search/multi', { query })
    )

    if (!data?.results) return []

    const genres = await this._getGenres()

    return data.results
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, EXTERNAL_SEARCH_TAKE)
      .map(item => this._toExternalTitle(item, genres))
  }

  async findByExternalId(
    externalId: string,
    type?: TitleType
  ): Promise<IExternalTitle | null> {
    const path = type === TitleType.TV_SHOW ? 'tv' : 'movie'

    const item = await this.fetchJson<ITmdbItem>(
      this._url(`/${path}/${externalId}`, { append_to_response: 'credits' })
    )

    if (!item) return null

    return this._toExternalTitle(
      { ...item, media_type: path },
      await this._getGenres()
    )
  }

  // Приватные хелперы

  private _toExternalTitle(
    item: ITmdbItem,
    genresDict: Map<number, string>
  ): IExternalTitle {
    const isTvShow = item.media_type === 'tv'

    const genres = item.genres?.length
      ? item.genres.map(({ name }) => name)
      : (item.genre_ids ?? [])
          .map(id => genresDict.get(id))
          .filter((name): name is string => Boolean(name))

    return {
      externalId: String(item.id),
      externalSource: this.source,
      type: isTvShow ? TitleType.TV_SHOW : TitleType.MOVIE,
      name: item.title ?? item.name ?? '',
      originalName: item.original_title ?? item.original_name,
      description: item.overview || undefined,
      coverUrl: item.poster_path
        ? `${TMDB_IMAGE_URL}${item.poster_path}`
        : undefined,
      releaseDate: this.toDate(item.release_date ?? item.first_air_date),
      rating: item.vote_average,
      ratingCount: item.vote_count,
      genres,
      actors: this._getActors(item),
      metadata: {
        ...(item.number_of_seasons ? { seasons: item.number_of_seasons } : {}),
        ...(item.number_of_episodes
          ? { episodes: item.number_of_episodes }
          : {}),
        ...(item.runtime ? { runtimeMinutes: item.runtime } : {})
      }
    }
  }

  /** Берём только первых по порядку: в касте бывают сотни человек */
  private _getActors(item: ITmdbItem): { name: string; photoUrl?: string }[] {
    return (item.credits?.cast ?? [])
      .filter(({ name }) => Boolean(name))
      .slice(0, TMDB_CAST_LIMIT)
      .map(({ name, profile_path }) => ({
        name: name as string,
        photoUrl: profile_path ? `${TMDB_IMAGE_URL}${profile_path}` : undefined
      }))
  }

  private async _getGenres(): Promise<Map<number, string>> {
    if (this.genresCache) return this.genresCache

    const [movie, tv] = await Promise.all([
      this.fetchJson<ITmdbGenresResponse>(this._url('/genre/movie/list', {})),
      this.fetchJson<ITmdbGenresResponse>(this._url('/genre/tv/list', {}))
    ])

    const genres = new Map<number, string>()

    ;[...(movie?.genres ?? []), ...(tv?.genres ?? [])].forEach(({ id, name }) =>
      genres.set(id, name)
    )

    // Пустой словарь не кешируем — иначе одна неудача сломает жанры навсегда
    if (genres.size) this.genresCache = genres

    return genres
  }

  private _url(path: string, params: Record<string, string>): string {
    const search = new URLSearchParams({
      api_key: this.configService.get<string>('TMDB_API_KEY') ?? '',
      ...params
    })

    return `${TMDB_BASE_URL}${path}?${search}`
  }
}
