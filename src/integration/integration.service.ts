import { CACHE_MANAGER } from '@nestjs/cache-manager'
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { Cache } from 'cache-manager'

import { GENRES, IGenre } from '../constants/genres.constants'
import { EXTERNAL_CACHE_TTL_MS } from '../constants/integration.constants'

import { Prisma } from '../generated/prisma/client'
import { ExternalSource, TitleType } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { toDiscoverKey } from '../utils/discover-key'
import { generateSlug } from '../utils/generate-slug'
import { normalizeText } from '../utils/normalize-text'

import {
  IExternalSearchFilters,
  IExternalTitle,
  ITitleProvider
} from './interfaces/title-provider.interface'
import { GoogleBooksProvider } from './providers/google-books.provider'
import { RawgProvider } from './providers/rawg.provider'
import { ShikimoriProvider } from './providers/shikimori.provider'
import { TmdbProvider } from './providers/tmdb.provider'
import {
  ExternalTitleResponse,
  ImportedTitleResponse
} from './response/external-title-response'
import { GenreResponse } from './response/genre-response'

/** Сохранение тайтла, отложенное до транзакции вызывающего */
export type TSaveTitle = (
  prisma: Prisma.TransactionClient
) => Promise<ImportedTitleResponse>

@Injectable()
export class IntegrationService {
  private readonly providers: ITitleProvider[]

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private prisma: PrismaService,
    tmdb: TmdbProvider,
    rawg: RawgProvider,
    googleBooks: GoogleBooksProvider,
    shikimori: ShikimoriProvider
  ) {
    this.providers = [tmdb, rawg, googleBooks, shikimori]
  }

  /**
   * Поиск во внешних источниках. Провайдеры опрашиваются параллельно,
   * упавший источник не ломает выдачу остальных.
   *
   * С фильтрами кэш не используем: RAWG и Shikimori получают их в запросе,
   * поэтому их ответ уже не тот, что для обычного поиска, и под ключом
   * (запрос, типы) он испортил бы выдачу без фильтров
   */
  async search(
    query: string,
    types?: TitleType[],
    filters?: { genres?: string[]; yearFrom?: number; yearTo?: number }
  ): Promise<ExternalTitleResponse[]> {
    const { yearFrom, yearTo } = filters ?? {}

    if (yearFrom && yearTo && yearFrom > yearTo) {
      throw new BadRequestException('yearFrom must not be greater than yearTo')
    }

    const resolved: IExternalSearchFilters = {
      genres: GENRES.filter(({ slug }) => filters?.genres?.includes(slug)),
      yearFrom,
      yearTo
    }

    const hasFilters = Boolean(resolved.genres?.length || yearFrom || yearTo)
    const cacheKey = this._getCacheKey(query, types)

    const cached = hasFilters
      ? undefined
      : await this.cache.get<ExternalTitleResponse[]>(cacheKey)

    if (cached) return cached

    const providers = types?.length
      ? this.providers.filter(provider =>
          provider.supportedTypes.some(type => types.includes(type))
        )
      : this.providers

    const results = await Promise.all(
      providers.map(async provider => {
        const items = await provider.search(query, resolved)

        // TMDB и Google Books фильтровать не умеют — режем их выдачу сами
        return provider.hasNativeFilters
          ? items
          : this._applyFilters(items, resolved)
      })
    )

    // Сначала популярное: по неточному названию это чаще нужный тайтл
    const items = results
      .flat()
      .filter(item => !types?.length || types.includes(item.type))
      .sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
      .map(item => ({
        ...item,
        originalName: item.originalName ?? null,
        description: item.description ?? null,
        coverUrl: item.coverUrl ?? null,
        releaseDate: item.releaseDate ?? null,
        rating: item.rating ?? null,
        ratingCount: item.ratingCount ?? null,
        key: toDiscoverKey({
          source: item.externalSource,
          type: item.type,
          externalId: item.externalId
        })
      }))

    // Пустую выдачу не кешируем: она чаще означает недоступный источник,
    // а не отсутствие результата
    if (items.length && !hasFilters) {
      await this.cache.set(cacheKey, items, EXTERNAL_CACHE_TTL_MS)
    }

    return items
  }

  /**
   * Импорт в две фазы: внешний API опрашиваем сразу, а запись в базу
   * отдаём вызывающему. Так он сохранит тайтл в своей транзакции вместе
   * с отзывом или записью библиотеки, и транзакция не будет висеть
   * открытой, пока ждём ответ внешнего API
   */
  async prepareImport(
    source: ExternalSource,
    externalId: string,
    type: TitleType
  ): Promise<TSaveTitle> {
    const existing = await this.findImported(source, externalId, type)

    if (existing) return () => Promise.resolve(existing)

    // Без проверки типа TMDB по ключу `tmdb-game-603` вернул бы фильм
    const provider = this.providers.find(
      provider =>
        provider.source === source && provider.supportedTypes.includes(type)
    )

    if (!provider) throw new NotFoundException('Source is not supported')

    const external = await provider.findByExternalId(externalId, type)

    if (!external)
      throw new NotFoundException('Title not found in the external API')

    return prisma => this._saveTitle(prisma, external)
  }

  /** Тайтл, который уже есть у нас. В базу ничего не пишет */
  findImported(
    source: ExternalSource,
    externalId: string,
    type: TitleType
  ): Promise<ImportedTitleResponse | null> {
    return this.prisma.title.findUnique({
      where: {
        externalSource_type_externalId: {
          externalSource: source,
          type,
          externalId
        }
      },
      select: { id: true, slug: true }
    })
  }

  // Приватные хелперы

  /** Список жанров для фильтра на фронте */
  getGenres(): GenreResponse[] {
    return GENRES.map(({ slug, label }) => ({ slug, label }))
  }

  /**
   * Без года или жанра у тайтла фильтру нечем его подтвердить,
   * поэтому такой тайтл в отфильтрованную выдачу не попадает
   */
  private _applyFilters(
    items: IExternalTitle[],
    { genres, yearFrom, yearTo }: IExternalSearchFilters
  ): IExternalTitle[] {
    return items.filter(item => {
      if (yearFrom || yearTo) {
        const year = item.releaseDate?.getUTCFullYear()

        if (!year || year < (yearFrom ?? 0) || year > (yearTo ?? Infinity)) {
          return false
        }
      }

      return (
        !genres?.length ||
        genres.some(genre => this._hasGenre(item.genres, genre))
      )
    })
  }

  private _hasGenre(itemGenres: string[], genre: IGenre): boolean {
    return itemGenres.some(name =>
      genre.aliases.some(alias => normalizeText(name).includes(alias))
    )
  }

  private _getCacheKey(query: string, types?: TitleType[]): string {
    const suffix = types?.length ? [...types].sort().join(',') : 'all'

    return `external:${query.trim().toLowerCase()}:${suffix}`
  }

  private async _saveTitle(
    prisma: Prisma.TransactionClient,
    external: IExternalTitle
  ): Promise<ImportedTitleResponse> {
    // description, возрастной рейтинг, люди и metadata не храним — они приходят из API
    // при открытии детальной страницы
    const {
      genres,
      cast: _cast,
      creators: _creators,
      metadata: _metadata,
      description: _description,
      ageRating: _ageRating,
      ...rest
    } = external

    // Жанры и связи с ними — отдельными запросами: вложенная запись
    // в upsert заставляет Prisma отказаться от INSERT … ON CONFLICT.
    // Сортируем, чтобы параллельные импорты блокировали жанры в одном
    // порядке — иначе две транзакции могут ждать друг друга вечно
    const genreIds = await Promise.all(
      [...genres].sort().map(name => this._upsertGenre(prisma, name))
    )

    // upsert, а не create: параллельный импорт того же тайтла дождётся
    // первого и получит его строку, а не ошибку уникального индекса.
    // update не пустой намеренно — с пустым Prisma делает SELECT + INSERT.
    // Заодно освежаем данные из источника
    const title = await prisma.title.upsert({
      where: {
        externalSource_type_externalId: {
          externalSource: external.externalSource,
          type: external.type,
          externalId: external.externalId
        }
      },
      create: {
        ...rest,
        slug: await this._getUniqueSlug(prisma, external.name)
      },
      update: rest,
      select: { id: true, slug: true }
    })

    await prisma.title.update({
      where: { id: title.id },
      data: { genres: { connect: genreIds } },
      select: { id: true }
    })

    return title
  }

  private _upsertGenre(
    prisma: Prisma.TransactionClient,
    name: string
  ): Promise<{ id: string }> {
    const slug = generateSlug(name)

    return prisma.genre.upsert({
      where: { slug },
      create: { name, slug },
      update: { name },
      select: { id: true }
    })
  }

  /** Slug тайтла глобально уникален: «vedmak-3», «vedmak-3-2», … */
  private async _getUniqueSlug(
    prisma: Prisma.TransactionClient,
    name: string
  ): Promise<string> {
    const base = generateSlug(name) || 'title'

    for (let suffix = 0; suffix < 100; suffix++) {
      const slug = suffix ? `${base}-${suffix + 1}` : base

      const existing = await prisma.title.findUnique({
        where: { slug },
        select: { id: true }
      })

      if (!existing) return slug
    }

    return `${base}-${Date.now()}`
  }
}
