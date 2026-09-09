import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Cache } from 'cache-manager'

import {
  EXTERNAL_CACHE_TTL_MS,
  TITLE_DETAILS_CACHE_TTL_MS
} from '../constants/integration.constants'

import { Prisma } from '../generated/prisma/client'
import { ExternalSource, TitleType } from '../generated/prisma/enums'
import { LibraryService } from '../library/library.service'
import { LibraryEntryResponse } from '../library/response/library-response'
import { PrismaService } from '../prisma/prisma.service'
import { generateSlug } from '../utils/generate-slug'

import { QuickAddDto } from './dto/quick-add.dto'
import {
  IExternalTitle,
  ITitleDetails,
  ITitleProvider
} from './interfaces/title-provider.interface'
import { GoogleBooksProvider } from './providers/google-books.provider'
import { RawgProvider } from './providers/rawg.provider'
import { ShikimoriProvider } from './providers/shikimori.provider'
import { TmdbProvider } from './providers/tmdb.provider'

@Injectable()
export class IntegrationService {
  private readonly providers: ITitleProvider[]

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private prisma: PrismaService,
    private readonly libraryService: LibraryService,
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
    type?: TitleType
  ): Promise<{ id: string; slug: string }> {
    const existing = await this.prisma.title.findUnique({
      where: {
        externalSource_externalId: { externalSource: source, externalId }
      },
      select: { id: true, slug: true }
    })

    if (existing) return existing

    const provider = this.providers.find(({ source: s }) => s === source)

    if (!provider) throw new NotFoundException('Source is not supported')

    const external = await provider.findByExternalId(externalId, type)

    if (!external)
      throw new NotFoundException('Title not found in the external API')

    return this._saveTitle(external)
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
    const cacheKey = `details:${source}:${externalId}`

    const cached = await this.cache.get<ITitleDetails>(cacheKey)

    if (cached) return cached

    const provider = this.providers.find(({ source: s }) => s === source)

    if (!provider) return null

    try {
      const external = await provider.findByExternalId(externalId, type)

      if (!external) return null

      const details: ITitleDetails = {
        description: external.description,
        actors: external.actors ?? [],
        metadata: external.metadata ?? {}
      }

      await this.cache.set(cacheKey, details, TITLE_DETAILS_CACHE_TTL_MS)

      return details
    } catch {
      // Недоступный источник не должен ронять страницу тайтла
      return null
    }
  }

  /** Импорт и добавление в библиотеку одним запросом — для расширения */
  async quickAdd(
    userId: string,
    dto: QuickAddDto
  ): Promise<LibraryEntryResponse> {
    const { id } = await this.importTitle(dto.source, dto.externalId, dto.type)

    const existing = await this.libraryService.findByTitle(userId, id)

    // Повторный клик по тому же тайтлу не должен падать ошибкой
    if (existing) return existing

    return this.libraryService.create(userId, {
      titleId: id,
      status: dto.status,
      rating: dto.rating
    })
  }

  // Приватные хелперы

  private _getCacheKey(query: string, types?: TitleType[]): string {
    const suffix = types?.length ? [...types].sort().join(',') : 'all'

    return `external:${query.trim().toLowerCase()}:${suffix}`
  }

  private async _saveTitle(
    external: IExternalTitle
  ): Promise<{ id: string; slug: string }> {
    // description, actors и metadata не храним — они приходят из API
    // при открытии детальной страницы
    const {
      genres,
      actors: _actors,
      metadata: _metadata,
      description: _description,
      ...rest
    } = external

    return this.prisma.title.create({
      data: {
        ...rest,
        slug: await this._getUniqueSlug(external.name),
        genres: {
          connectOrCreate: genres.map(name => ({
            where: { slug: generateSlug(name) },
            create: { name, slug: generateSlug(name) }
          }))
        }
      },
      select: { id: true, slug: true }
    })
  }

  /** Slug тайтла глобально уникален: «vedmak-3», «vedmak-3-2», … */
  private async _getUniqueSlug(name: string): Promise<string> {
    const base = generateSlug(name) || 'title'

    for (let suffix = 0; suffix < 100; suffix++) {
      const slug = suffix ? `${base}-${suffix + 1}` : base

      const existing = await this.prisma.title.findUnique({
        where: { slug },
        select: { id: true }
      })

      if (!existing) return slug
    }

    return `${base}-${Date.now()}`
  }
}
