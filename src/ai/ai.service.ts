import { CACHE_MANAGER } from '@nestjs/cache-manager'
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common'
import { Cache } from 'cache-manager'

import {
  AI_EXCLUDE_LIMIT,
  AI_LIBRARY_KEYS_LIMIT,
  AI_RECOMMENDATIONS_CACHE_TTL_MS,
  AI_RECOMMENDATIONS_COUNT,
  AI_TASTE_INSIGHT_TTL_MS,
  AI_TASTE_SAMPLE_SIZE,
  AI_USAGE_WINDOW_MS
} from '../constants/ai.constants'
import { FREE_PLAN_LIMITS } from '../constants/app.constants'
import { DiscoverItemResponse } from '../discover/response/discover-response'
import { DiscoverService } from '../discover/discover.service'
import {
  AiUsageKind,
  LibraryStatus,
  TitleType
} from '../generated/prisma/enums'
import { IntegrationService } from '../integration/integration.service'
import { ExternalTitleResponse } from '../integration/response/external-title-response'
import { PrismaService } from '../prisma/prisma.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { toDiscoverKey } from '../utils/discover-key'
import { normalizeText } from '../utils/normalize-text'

import { PickerDto } from './dto/picker.dto'
import {
  IAiSuggestionCandidate,
  ITasteContext,
  ITitleBrief
} from './interfaces/ai.interface'
import { OpenRouterService } from './openrouter.service'
import {
  buildPickerPrompt,
  buildRecommendationsPrompt,
  buildSpoilerFreePrompt,
  buildTasteInsightPrompt,
  SYSTEM_PROMPT
} from './prompts/prompts'
import {
  AiSuggestionResponse,
  AiSuggestionsResponse,
  AiSummaryResponse,
  TasteInsightResponse
} from './response/ai-response'

/** Форма, в которой модель обязана вернуть подборку */
interface IAiSuggestionsPayload {
  items?: {
    name?: string
    type?: string
    year?: number
    reason?: string
  }[]
}

/** Что уже есть в библиотеке: названия для промпта и ключи для сверки с ответом */
interface ILibrarySnapshot {
  names: string[]
  keys: Set<string>
}

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
    private readonly discoverService: DiscoverService,
    private readonly integrationService: IntegrationService,
    private readonly subscriptionService: SubscriptionService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  /** Кэш на пользователя на 24 часа: библиотека за сутки почти не меняется */
  async getRecommendations(userId: string): Promise<AiSuggestionsResponse> {
    const cacheKey = `ai:recommendations:${userId}`

    const cached = await this.cache.get<AiSuggestionsResponse>(cacheKey)

    if (cached) return cached

    const [taste, library] = await Promise.all([
      this._buildTasteContext(userId),
      this._getLibrary(userId)
    ])

    const payload = await this.openRouter.chatJson<IAiSuggestionsPayload>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildRecommendationsPrompt(taste, library.names)
        }
      ],
      'recommendations'
    )

    const response = { items: await this._matchSuggestions(payload, library) }

    // Пустую выдачу не кэшируем: чаще всего это сбой источников
    if (response.items.length) {
      await this.cache.set(cacheKey, response, AI_RECOMMENDATIONS_CACHE_TTL_MS)
    }

    return response
  }

  /**
   * AI Picker. Работает и с пустым запросом: тогда подбор идёт
   * только по вкусу — кнопка «удиви меня»
   */
  async pick(userId: string, dto: PickerDto): Promise<AiSuggestionsResponse> {
    await this._ensureWithinDailyLimit(userId)

    const [taste, library] = await Promise.all([
      this._buildTasteContext(userId),
      dto.excludeLibrary === false ? null : this._getLibrary(userId)
    ])

    const payload = await this.openRouter.chatJson<IAiSuggestionsPayload>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildPickerPrompt({
            mood: dto.mood ?? '',
            types: dto.type ?? [],
            duration: dto.duration,
            exclude: library?.names ?? [],
            taste
          })
        }
      ],
      'picker'
    )

    await this._recordUsage(userId, AiUsageKind.PICKER)

    return { items: await this._matchSuggestions(payload, library) }
  }

  /**
   * Описание без спойлеров. Хранится в базе навсегда и на тайтл, а не
   * на пользователя: один запрос к модели на весь каталог. Тайтл берём
   * из витрины, как GET /discover/{key}: в базе его может не быть
   */
  async getSpoilerFreeSummary(key: string): Promise<AiSummaryResponse> {
    const saved = await this.prisma.aiSummary.findUnique({
      where: { key },
      select: { summary: true }
    })

    if (saved) return saved

    const title = await this.discoverService.findByKey(key)

    const { summary } = await this.openRouter.chatJson<{ summary?: string }>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildSpoilerFreePrompt({
            name: title.name,
            type: title.type,
            year: title.releaseDate?.getUTCFullYear() ?? null,
            genres: title.genres,
            description: title.description
          })
        }
      ],
      'summary'
    )

    // Пустое описание не сохраняем, чтобы не закрепить его навсегда
    if (!summary) return { summary: '' }

    // Ключ берём у тайтла: так одно произведение не запишется под разными написаниями
    await this.prisma.aiSummary.upsert({
      where: { key: title.key },
      create: { key: title.key, summary },
      update: { summary }
    })

    return { summary }
  }

  /**
   * Текст для Taste DNA. Живёт в базе неделю; публичная страница читает
   * его оттуда и модель сама не вызывает
   */
  async getTasteInsight(userId: string): Promise<TasteInsightResponse> {
    const saved = await this.prisma.aiTasteInsight.findUnique({
      where: { userId },
      select: { insight: true, updatedAt: true }
    })

    if (
      saved &&
      saved.updatedAt.getTime() > Date.now() - AI_TASTE_INSIGHT_TTL_MS
    ) {
      return { insight: saved.insight, generatedAt: saved.updatedAt }
    }

    const entriesCount = await this.prisma.libraryEntry.count({
      where: { userId }
    })

    if (!entriesCount) {
      throw new BadRequestException('Add some titles to your library first')
    }

    await this._ensureWithinDailyLimit(userId)

    const { insight } = await this.openRouter.chatJson<{ insight?: string }>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildTasteInsightPrompt(
            await this._buildTasteContext(userId)
          )
        }
      ],
      'taste-insight'
    )

    if (!insight) {
      throw new ServiceUnavailableException(
        'AI returned an unexpected response'
      )
    }

    const { updatedAt } = await this.prisma.aiTasteInsight.upsert({
      where: { userId },
      create: { userId, insight },
      update: { insight },
      select: { updatedAt: true }
    })

    await this._recordUsage(userId, AiUsageKind.TASTE_INSIGHT)

    return { insight, generatedAt: updatedAt }
  }

  // Приватные хелперы

  /**
   * Лимит бесплатного тарифа — за скользящие сутки, а не за календарный
   * день, чтобы не зависеть от часового пояса. Запрос записываем после
   * ответа модели (упавший вызов лимит не тратит); от пачки параллельных
   * запросов защищает Throttler на ручках
   */
  private async _ensureWithinDailyLimit(userId: string): Promise<void> {
    if (await this.subscriptionService.isProActive(userId)) return

    const used = await this.prisma.aiUsage.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - AI_USAGE_WINDOW_MS) }
      }
    })

    if (used >= FREE_PLAN_LIMITS.aiRequestsPerDay) {
      throw new HttpException(
        `Free plan is limited to ${FREE_PLAN_LIMITS.aiRequestsPerDay} AI requests per day. Upgrade to remove the limit`,
        HttpStatus.TOO_MANY_REQUESTS
      )
    }
  }

  private async _recordUsage(userId: string, kind: AiUsageKind): Promise<void> {
    await this.prisma.aiUsage.create({ data: { userId, kind } })
  }

  /** Библиотека пользователя: что не предлагать и с чем сверять ответ */
  private async _getLibrary(userId: string): Promise<ILibrarySnapshot> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      take: AI_LIBRARY_KEYS_LIMIT,
      orderBy: { updatedAt: 'desc' },
      select: {
        title: {
          select: {
            name: true,
            type: true,
            externalSource: true,
            externalId: true
          }
        }
      }
    })

    const keys = new Set<string>()

    entries.forEach(({ title }) => {
      if (!title.externalSource || !title.externalId) return

      keys.add(
        toDiscoverKey({
          source: title.externalSource,
          type: title.type,
          externalId: title.externalId
        })
      )
    })

    return {
      names: entries.slice(0, AI_EXCLUDE_LIMIT).map(({ title }) => title.name),
      keys
    }
  }

  /** Что модель узнаёт о пользователе. В промпт уходит только это */
  private async _buildTasteContext(userId: string): Promise<ITasteContext> {
    const rows = await this.prisma.libraryEntry.findMany({
      where: { userId },
      take: AI_TASTE_SAMPLE_SIZE * 3,
      orderBy: { updatedAt: 'desc' },
      select: {
        status: true,
        title: {
          select: {
            name: true,
            type: true,
            genres: { select: { name: true } },
            reviews: { where: { userId }, select: { rating: true } }
          }
        }
      }
    })

    // Оценка живёт в отзыве: у пользователя на тайтл он максимум один
    const entries = rows.map(({ status, title: { reviews, ...title } }) => ({
      status,
      title,
      rating: reviews[0]?.rating ?? null
    }))

    const toBrief = (entry: (typeof entries)[number]): ITitleBrief => ({
      name: entry.title.name,
      type: entry.title.type,
      rating: entry.rating,
      genres: entry.title.genres.map(({ name }) => name)
    })

    const rated = entries.filter(({ rating }) => rating !== null)

    return {
      favoriteGenres: this._getTopGenres(entries),
      topRated: [...rated]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, AI_TASTE_SAMPLE_SIZE)
        .map(toBrief),
      recentlyCompleted: entries
        .filter(({ status }) => status === LibraryStatus.COMPLETED)
        .slice(0, AI_TASTE_SAMPLE_SIZE)
        .map(toBrief),
      inProgress: entries
        .filter(({ status }) => status === LibraryStatus.IN_PROGRESS)
        .slice(0, 5)
        .map(toBrief),
      averageRating: rated.length
        ? Number(
            (
              rated.reduce((sum, { rating }) => sum + (rating ?? 0), 0) /
              rated.length
            ).toFixed(1)
          )
        : null
    }
  }

  /**
   * Модель возвращает названия текстом, а фронту нужны ключи витрины.
   * Каждое название ищем через внешний поиск; берём только точное
   * совпадение имени и года ±1, остальное отбрасываем: неверная карточка
   * хуже, чем на одну рекомендацию меньше
   */
  private async _matchSuggestions(
    payload: IAiSuggestionsPayload,
    library: ILibrarySnapshot | null
  ): Promise<AiSuggestionResponse[]> {
    const candidates = (payload.items ?? []).filter(
      (item): item is IAiSuggestionCandidate =>
        Boolean(item.name) &&
        Object.values(TitleType).includes(item.type as TitleType) &&
        Number.isInteger(item.year) &&
        typeof item.reason === 'string'
    )

    const matches = await Promise.all(
      candidates.map(async candidate => {
        const found = await this._findExternal(candidate)

        return (
          found && {
            item: this._toDiscoverItem(found),
            reason: candidate.reason
          }
        )
      })
    )

    const seen = new Set<string>()

    return matches
      .filter((match): match is AiSuggestionResponse => match !== null)
      .filter(({ item }) => {
        // Модель может повториться, а знакомое пользователю не показываем
        if (seen.has(item.key) || library?.keys.has(item.key)) return false

        seen.add(item.key)

        return true
      })
      .slice(0, AI_RECOMMENDATIONS_COUNT)
  }

  private async _findExternal(
    candidate: IAiSuggestionCandidate
  ): Promise<ExternalTitleResponse | null> {
    const name = normalizeText(candidate.name)

    // Поиск уже отсортирован по популярности, поэтому берём первое совпадение
    const results = await this.integrationService.search(candidate.name, [
      candidate.type
    ])

    return (
      results.find(result => {
        const isNameMatch = [result.name, result.originalName].some(
          value => value && normalizeText(value) === name
        )

        if (!isNameMatch || !result.releaseDate) return false

        const year = new Date(result.releaseDate).getUTCFullYear()

        return Math.abs(year - candidate.year) <= 1
      }) ?? null
    )
  }

  private _toDiscoverItem(item: ExternalTitleResponse): DiscoverItemResponse {
    return {
      key: item.key,
      externalId: item.externalId,
      externalSource: item.externalSource,
      type: item.type,
      name: item.name,
      coverUrl: item.coverUrl,
      releaseDate: item.releaseDate,
      rating: item.rating,
      genres: item.genres
    }
  }

  private _getTopGenres(
    entries: { title: { genres: { name: string }[] } }[]
  ): string[] {
    const counts = entries.reduce<Record<string, number>>((acc, { title }) => {
      title.genres.forEach(({ name }) => {
        acc[name] = (acc[name] ?? 0) + 1
      })

      return acc
    }, {})

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name)
  }
}
