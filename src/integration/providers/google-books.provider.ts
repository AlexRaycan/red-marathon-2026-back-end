import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  EXTERNAL_SEARCH_TAKE,
  GOOGLE_BOOKS_BASE_URL
} from '../../constants/integration.constants'
import { ExternalSource, TitleType } from '../../generated/prisma/enums'
import {
  IExternalTitle,
  ITitleProvider
} from '../interfaces/title-provider.interface'

import { BaseProvider } from './base-provider'

/**
 * Google Books — книги.
 * @see https://developers.google.com/books/docs/v1/using
 *
 * Пример элемента из /volumes:
 * {
 *   "id": "xyz123",
 *   "volumeInfo": {
 *     "title": "Последнее желание", "authors": ["Анджей Сапковский"],
 *     "publishedDate": "1993", "description": "...", "pageCount": 288,
 *     "categories": ["Fiction"], "averageRating": 4.5, "ratingsCount": 120,
 *     "imageLinks": { "thumbnail": "http://..." }
 *   }
 * }
 */
interface IGoogleBook {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    categories?: string[]
    averageRating?: number
    ratingsCount?: number
    language?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  }
}

interface IGoogleBooksResponse {
  items?: IGoogleBook[]
}

@Injectable()
export class GoogleBooksProvider
  extends BaseProvider
  implements ITitleProvider
{
  readonly source = ExternalSource.GOOGLE_BOOKS
  readonly supportedTypes = [TitleType.BOOK]

  constructor(private readonly configService: ConfigService) {
    super()
  }

  async search(query: string): Promise<IExternalTitle[]> {
    const data = await this.fetchJson<IGoogleBooksResponse>(
      this._url('/volumes', {
        q: query,
        maxResults: String(EXTERNAL_SEARCH_TAKE)
      })
    )

    return (data?.items ?? [])
      .filter(book => book.volumeInfo?.title)
      .map(book => this._toExternalTitle(book))
  }

  async findByExternalId(externalId: string): Promise<IExternalTitle | null> {
    const book = await this.fetchJson<IGoogleBook>(
      this._url(`/volumes/${externalId}`, {})
    )

    return book?.volumeInfo?.title ? this._toExternalTitle(book) : null
  }

  private _toExternalTitle(book: IGoogleBook): IExternalTitle {
    const info = book.volumeInfo ?? {}

    return {
      externalId: book.id,
      externalSource: this.source,
      type: TitleType.BOOK,
      name: info.title ?? '',
      description: info.description || undefined,
      // Google отдаёт http-ссылки, принудительно переводим на https
      coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://'),
      releaseDate: this.toDate(info.publishedDate),
      // У Google 5-балльная шкала
      rating: info.averageRating ? info.averageRating * 2 : undefined,
      ratingCount: info.ratingsCount,
      genres: info.categories ?? [],
      // У книг «создатели» — авторы
      actors: (info.authors ?? []).map(name => ({ name })),
      metadata: {
        authors: info.authors ?? [],
        ...(info.pageCount ? { pageCount: info.pageCount } : {}),
        ...(info.publisher ? { publisher: info.publisher } : {}),
        ...(info.language ? { language: info.language } : {})
      }
    }
  }

  private _url(path: string, params: Record<string, string>): string {
    const apiKey = this.configService.get<string>('GOOGLE_BOOKS_API_KEY')

    const search = new URLSearchParams({
      ...params,
      ...(apiKey ? { key: apiKey } : {})
    })

    return `${GOOGLE_BOOKS_BASE_URL}${path}?${search}`
  }
}
