import { Injectable } from '@nestjs/common'

import {
  EXTERNAL_SEARCH_TAKE,
  SHIKIMORI_BASE_URL,
  SHIKIMORI_USER_AGENT
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
 * @see https://shikimori.one/api/doc
 *
 * Пример элемента из /animes:
 * {
 *   "id": 16498, "name": "Shingeki no Kyojin", "russian": "Атака титанов",
 *   "image": { "original": "/system/animes/original/16498.jpg" },
 *   "aired_on": "2013-04-07", "episodes": 25, "score": "8.54", "kind": "tv"
 * }
 * Ссылки на картинки относительные — дополняем доменом.
 */
interface IShikimoriAnime {
  id: number
  name: string
  russian?: string
  description?: string
  image?: { original?: string; preview?: string }
  aired_on?: string
  episodes?: number
  episodes_aired?: number
  duration?: number
  score?: string
  kind?: string
  status?: string
  genres?: { russian?: string; name: string }[]
  studios?: { name: string; image?: string | null }[]
}

@Injectable()
export class ShikimoriProvider extends BaseProvider implements ITitleProvider {
  readonly source = ExternalSource.SHIKIMORI
  readonly supportedTypes = [TitleType.ANIME]

  async search(query: string): Promise<IExternalTitle[]> {
    const search = new URLSearchParams({
      search: query,
      limit: String(EXTERNAL_SEARCH_TAKE)
    })

    const items = await this.fetchJson<IShikimoriAnime[]>(
      `${SHIKIMORI_BASE_URL}/animes?${search}`,
      { 'User-Agent': SHIKIMORI_USER_AGENT }
    )

    return (items ?? []).map(anime => this._toExternalTitle(anime))
  }

  async findByExternalId(externalId: string): Promise<IExternalTitle | null> {
    const anime = await this.fetchJson<IShikimoriAnime>(
      `${SHIKIMORI_BASE_URL}/animes/${externalId}`,
      { 'User-Agent': SHIKIMORI_USER_AGENT }
    )

    return anime ? this._toExternalTitle(anime) : null
  }

  private _toExternalTitle(anime: IShikimoriAnime): IExternalTitle {
    return {
      externalId: String(anime.id),
      externalSource: this.source,
      type: TitleType.ANIME,
      // Продукт англоязычный: romaji-название основное, русское не используем
      name: anime.name,
      originalName: anime.russian,
      description: this._stripBbCode(anime.description),
      coverUrl: anime.image?.original
        ? `https://shikimori.one${anime.image.original}`
        : undefined,
      releaseDate: this.toDate(anime.aired_on),
      rating: anime.score ? Number(anime.score) : undefined,
      genres: (anime.genres ?? []).map(({ name }) => name),
      // У аниме «создатели» — студии
      actors: (anime.studios ?? []).map(({ name }) => ({ name })),
      metadata: {
        ...(anime.episodes ? { episodes: anime.episodes } : {}),
        ...(anime.duration ? { episodeDurationMinutes: anime.duration } : {}),
        ...(anime.kind ? { kind: anime.kind } : {}),
        ...(anime.status ? { airingStatus: anime.status } : {})
      }
    }
  }

  /** Описания приходят с разметкой вида [character=123]…[/character] */
  private _stripBbCode(text?: string): string | undefined {
    if (!text) return undefined

    return text.replace(/\[\/?[^\]]+\]/g, '').trim() || undefined
  }
}
