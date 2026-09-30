import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SIMILAR_TAKE } from '../../constants/app.constants'
import {
  EXTERNAL_SEARCH_TAKE,
  GOOGLE_BOOKS_BASE_URL,
  GOOGLE_BOOKS_COVER_WIDTH,
  GOOGLE_BOOKS_MAX_RESULTS,
  OPEN_LIBRARY_COVERS_URL,
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
    /** MATURE или NOT_MATURE — другой возрастной разметки у Google нет */
    maturityRating?: string
    industryIdentifiers?: { type: string; identifier: string }[]
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

    return this._toExternalTitles(data?.items ?? [])
  }

  /**
   * Трендов у Google Books нет — берём свежую англоязычную художку.
   * Книги, для которых обложки нет ни в Google, ни в Open Library,
   * отсекаем: в верхнем блоке главной они смотрятся пусто
   */
  async getTrending(): Promise<IExternalTitle[]> {
    const data = await this.fetchJson<IGoogleBooksResponse>(
      this._url('/volumes', {
        q: 'subject:fiction',
        orderBy: 'newest',
        printType: 'books',
        langRestrict: 'en',
        maxResults: String(TRENDING_TAKE_PER_SOURCE)
      })
    )

    const items = await this._toExternalTitles(data?.items ?? [])

    return items.filter(({ coverUrl }) => Boolean(coverUrl))
  }

  async findByExternalId(externalId: string): Promise<IExternalTitle | null> {
    const book = await this.fetchJson<IGoogleBook>(
      this._url(`/volumes/${externalId}`, {})
    )

    const [item] = await this._toExternalTitles(book ? [book] : [])

    return item ?? null
  }

  /**
   * «Похожих» у Google Books нет, а категории слишком общие («Fiction»),
   * поэтому берём другие книги того же автора. У одной книги бывает
   * десяток изданий — дубли по названию отсекаем, как и саму книгу
   */
  async getSimilar(title: IExternalTitle): Promise<IExternalTitle[]> {
    const [author] = title.creators ?? []

    if (!author) return []

    const data = await this.fetchJson<IGoogleBooksResponse>(
      this._url('/volumes', {
        q: `inauthor:"${author.name}"`,
        printType: 'books',
        maxResults: String(GOOGLE_BOOKS_MAX_RESULTS)
      })
    )

    const seenNames = new Set([title.name.toLowerCase()])

    // Дубли отсекаем до поиска обложек — чтобы не проверять лишние книги
    const books = (data?.items ?? [])
      .filter(({ volumeInfo }) => {
        const key = volumeInfo?.title?.toLowerCase()

        if (!key || seenNames.has(key)) return false

        seenNames.add(key)

        return true
      })
      .slice(0, SIMILAR_TAKE)

    return this._toExternalTitles(books)
  }

  // Приватные хелперы

  /**
   * Книги без названия отбрасываем. У части книг Google не отдаёт обложку —
   * для них ищем её в Open Library по ISBN, параллельно
   */
  private _toExternalTitles(books: IGoogleBook[]): Promise<IExternalTitle[]> {
    return Promise.all(
      books
        .filter(book => book.volumeInfo?.title)
        .map(async book => {
          const item = this._toExternalTitle(book)

          if (item.coverUrl) return item

          return { ...item, coverUrl: await this._findOpenLibraryCover(book) }
        })
    )
  }

  private async _findOpenLibraryCover(
    book: IGoogleBook
  ): Promise<string | undefined> {
    const identifiers = book.volumeInfo?.industryIdentifiers ?? []

    const isbn = (
      identifiers.find(({ type }) => type === 'ISBN_13') ??
      identifiers.find(({ type }) => type === 'ISBN_10')
    )?.identifier

    if (!isbn) return undefined

    const coverUrl = `${OPEN_LIBRARY_COVERS_URL}/${isbn}-L.jpg`

    // Без default=false Open Library вместо 404 отдаёт пустую картинку 1×1
    const isFound = await this.exists(`${coverUrl}?default=false`)

    return isFound ? coverUrl : undefined
  }

  private _toExternalTitle(book: IGoogleBook): IExternalTitle {
    const info = book.volumeInfo ?? {}

    return {
      externalId: book.id,
      externalSource: this.source,
      type: TitleType.BOOK,
      name: info.title ?? '',
      description: info.description || undefined,
      coverUrl: this._getCoverUrl(info.imageLinks?.thumbnail),
      releaseDate: this.toDate(info.publishedDate),
      // У Google 5-балльная шкала
      rating: info.averageRating ? info.averageRating * 2 : undefined,
      ratingCount: info.ratingsCount,
      genres: info.categories ?? [],
      ageRating: info.maturityRating === 'MATURE' ? '18+' : undefined,
      creators: (info.authors ?? []).map(name => ({
        name,
        role: CreatorRoleEnum.Author
      })),
      metadata: {
        authors: info.authors ?? [],
        ...(info.pageCount ? { pageCount: info.pageCount } : {}),
        ...(info.publisher ? { publisher: info.publisher } : {}),
        ...(info.language ? { language: info.language } : {})
      }
    }
  }

  /**
   * thumbnail у Google — превью 128px (zoom=1) с загнутым уголком (edge=curl).
   * Вместо zoom просим точную ширину через fife: zoom=0 отдаёт то 800px,
   * то 1700px и полмегабайта
   */
  private _getCoverUrl(thumbnail?: string): string | undefined {
    if (!thumbnail) return undefined

    // Google отдаёт http-ссылки, принудительно переводим на https
    const url = new URL(thumbnail.replace('http://', 'https://'))

    url.searchParams.delete('zoom')
    url.searchParams.delete('edge')
    url.searchParams.set('fife', `w${GOOGLE_BOOKS_COVER_WIDTH}`)

    return url.toString()
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
