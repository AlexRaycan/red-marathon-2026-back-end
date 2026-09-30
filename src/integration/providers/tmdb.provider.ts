import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SIMILAR_TAKE } from '../../constants/app.constants'
import {
  EXTERNAL_SEARCH_TAKE,
  TMDB_AGE_RATING_COUNTRY,
  TMDB_BASE_URL,
  TMDB_CAST_LIMIT,
  TMDB_IMAGE_URL,
  TRENDING_TAKE_PER_SOURCE
} from '../../constants/integration.constants'
import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import {
  CreatorRoleEnum,
  IExternalCreator,
  IExternalPerson,
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
  credits?: { cast?: ITmdbPerson[]; crew?: ITmdbCrewMember[] }
  /** Возрастной рейтинг фильма — по странам и датам релиза */
  release_dates?: {
    results: {
      iso_3166_1: string
      release_dates: { certification: string }[]
    }[]
  }
  /** Возрастной рейтинг сериала — по странам */
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] }
  /** Авторы идеи — есть только у сериалов */
  created_by?: ITmdbPerson[]
}

/** Люди приходят только в деталях тайтла, в поиске их нет */
interface ITmdbPerson {
  name?: string
  profile_path?: string | null
}

/** Съёмочная группа: операторы, композиторы… Нам нужен только режиссёр */
interface ITmdbCrewMember extends ITmdbPerson {
  job?: string
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

    return this._toExternalTitles(data, EXTERNAL_SEARCH_TAKE)
  }

  /** Фильмы и сериалы, о которых говорят на этой неделе */
  async getTrending(): Promise<IExternalTitle[]> {
    const data = await this.fetchJson<ITmdbSearchResponse>(
      this._url('/trending/all/week', {})
    )

    return this._toExternalTitles(data, TRENDING_TAKE_PER_SOURCE)
  }

  async findByExternalId(
    externalId: string,
    type?: TitleType
  ): Promise<IExternalTitle | null> {
    const path = this._getPath(type)

    const item = await this.fetchJson<ITmdbItem>(
      this._url(`/${path}/${externalId}`, {
        append_to_response: `credits,${path === 'tv' ? 'content_ratings' : 'release_dates'}`
      })
    )

    if (!item) return null

    return this._toExternalTitle(
      { ...item, media_type: path },
      await this._getGenres()
    )
  }

  /**
   * Рекомендации TMDB строятся по тому, что зрители смотрят вместе, —
   * это точнее, чем /similar, который подбирает только по жанрам и ключевым словам
   */
  async getSimilar(title: IExternalTitle): Promise<IExternalTitle[]> {
    const path = this._getPath(title.type)

    const data = await this.fetchJson<ITmdbSearchResponse>(
      this._url(`/${path}/${title.externalId}/recommendations`, {})
    )

    // Фильму рекомендуют фильмы, сериалу — сериалы: тип проставляем сами,
    // чтобы не зависеть от того, пришёл ли media_type в ответе
    const results = (data?.results ?? []).map(item => ({
      ...item,
      media_type: path
    }))

    return this._toExternalTitles({ results }, SIMILAR_TAKE)
  }

  // Приватные хелперы

  /** Фильмы и сериалы у TMDB живут под разными путями */
  private _getPath(type?: TitleType): 'movie' | 'tv' {
    return type === TitleType.TV_SHOW ? 'tv' : 'movie'
  }

  /** В общих списках TMDB бывают и люди — оставляем только фильмы и сериалы */
  private async _toExternalTitles(
    data: ITmdbSearchResponse | null,
    take: number
  ): Promise<IExternalTitle[]> {
    if (!data?.results) return []

    const genres = await this._getGenres()

    return data.results
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, take)
      .map(item => this._toExternalTitle(item, genres))
  }

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
      ageRating: this._getAgeRating(item),
      cast: (item.credits?.cast ?? [])
        .slice(0, TMDB_CAST_LIMIT)
        .flatMap(person => this._toPerson(person)),
      creators: this._getCreators(item),
      metadata: {
        ...(item.number_of_seasons ? { seasons: item.number_of_seasons } : {}),
        ...(item.number_of_episodes
          ? { episodes: item.number_of_episodes }
          : {}),
        ...(item.runtime ? { runtimeMinutes: item.runtime } : {})
      }
    }
  }

  /**
   * У фильма — режиссёр. У сериала режиссёров десятки, по одному на серию,
   * поэтому берём авторов идеи (created_by)
   */
  private _getCreators(item: ITmdbItem): IExternalCreator[] {
    if (item.media_type === 'tv') {
      return (item.created_by ?? [])
        .flatMap(person => this._toPerson(person))
        .map(person => ({ ...person, role: CreatorRoleEnum.Creator }))
    }

    return (item.credits?.crew ?? [])
      .filter(({ job }) => job === 'Director')
      .flatMap(person => this._toPerson(person))
      .map(person => ({ ...person, role: CreatorRoleEnum.Director }))
  }

  /** Есть только в деталях: в поиске и трендах release_dates не приходят */
  private _getAgeRating(item: ITmdbItem): string | undefined {
    if (item.media_type === 'tv') {
      return (
        item.content_ratings?.results.find(
          ({ iso_3166_1 }) => iso_3166_1 === TMDB_AGE_RATING_COUNTRY
        )?.rating || undefined
      )
    }

    // У фильма несколько релизов (кино, цифра, ТВ) — рейтинг есть не у всех
    return item.release_dates?.results
      .find(({ iso_3166_1 }) => iso_3166_1 === TMDB_AGE_RATING_COUNTRY)
      ?.release_dates.map(({ certification }) => certification)
      .find(Boolean)
  }

  /** Без имени человека не показать — такие записи отбрасываем */
  private _toPerson({ name, profile_path }: ITmdbPerson): IExternalPerson[] {
    if (!name) return []

    return [
      {
        name,
        photoUrl: profile_path ? `${TMDB_IMAGE_URL}${profile_path}` : undefined
      }
    ]
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
