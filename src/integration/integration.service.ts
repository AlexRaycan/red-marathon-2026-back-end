import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Cache } from 'cache-manager'

import {
  EXTERNAL_CACHE_TTL_MS,
  TITLE_DETAILS_CACHE_TTL_MS
} from '../constants/integration.constants'

import { Prisma } from '../generated/prisma/client'
import { ExternalSource, TitleType } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { generateSlug } from '../utils/generate-slug'

import {
  IExternalTitle,
  ITitleDetails,
  ITitleProvider
} from './interfaces/title-provider.interface'
import { GoogleBooksProvider } from './providers/google-books.provider'
import { RawgProvider } from './providers/rawg.provider'
import { ShikimoriProvider } from './providers/shikimori.provider'
import { TmdbProvider } from './providers/tmdb.provider'
import { ImportedTitleResponse } from './response/external-title-response'

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
   */
  async search(query: string, types?: TitleType[]): Promise<IExternalTitle[]> {
    const cacheKey = this._getCacheKey(query, types)

    const cached = await this.cache.get<IExternalTitle[]>(cacheKey)

    if (cached) return cached

    const providers = types?.length
      ? this.providers.filter(provider =>
          provider.supportedTypes.some(type => types.includes(type))
        )
      : this.providers

    const results = await Promise.all(
      providers.map(provider => provider.search(query))
    )

    // Сначала популярное: по неточному названию это чаще нужный тайтл
    const items = results
      .flat()
      .sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))

    // Пустую выдачу не кешируем: она чаще означает недоступный источник,
    // а не отсутствие результата
    if (items.length) {
      await this.cache.set(cacheKey, items, EXTERNAL_CACHE_TTL_MS)
    }

    return items
  }

  /**
   * Сохраняет внешний тайтл к нам. Если он уже импортирован —
   * возвращает существующий, а не плодит дубль.
   */
  async importTitle(
    source: ExternalSource,
    externalId: string,
    type: TitleType
  ): Promise<ImportedTitleResponse> {
    const saveTitle = await this.prepareImport(source, externalId, type)

    return saveTitle(this.prisma)
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

  /**
   * Описание, актёры и специфика типа для детальной страницы.
   * В базе их не держим: они нужны только здесь и быстро устаревают.
   * Если внешний API недоступен — возвращаем null, страница не ломается
   */
  async getTitleDetails(
    source: ExternalSource,
    externalId: string,
    type: TitleType
  ): Promise<ITitleDetails | null> {
    const cacheKey = `details:${source}:${type}:${externalId}`

    const cached = await this.cache.get<ITitleDetails>(cacheKey)

    if (cached) return cached

    const provider = this.providers.find(({ source: s }) => s === source)

    if (!provider) return null

    try {
      const external = await provider.findByExternalId(externalId, type)

      if (!external) return null

      const details: ITitleDetails = {
        description: external.description,
        ageRating: external.ageRating,
        cast: external.cast ?? [],
        creators: external.creators ?? [],
        metadata: external.metadata ?? {}
      }

      await this.cache.set(cacheKey, details, TITLE_DETAILS_CACHE_TTL_MS)

      return details
    } catch {
      // Недоступный источник не должен ронять страницу тайтла
      return null
    }
  }

  // Приватные хелперы

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
