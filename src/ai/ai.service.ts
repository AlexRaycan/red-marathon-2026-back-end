import { Injectable, NotFoundException } from '@nestjs/common'

import {
  AI_EXCLUDE_LIMIT,
  AI_RECOMMENDATIONS_COUNT,
  AI_TASTE_SAMPLE_SIZE
} from '../constants/ai.constants'
import { LibraryStatus, TitleType } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'

import { PickerDto } from './dto/picker.dto'
import { ITasteContext, ITitleBrief } from './interfaces/ai.interface'
import { OpenRouterService } from './openrouter.service'
import {
  buildPickerPrompt,
  buildRecommendationsPrompt,
  buildSpoilerFreePrompt,
  SYSTEM_PROMPT
} from './prompts/prompts'
import {
  AiSuggestionResponse,
  AiSuggestionsResponse,
  AiSummaryResponse
} from './response/ai-response'

/** Форма, в которой модель обязана вернуть подборку */
interface IAiSuggestionsPayload {
  items?: { name?: string; type?: string; reason?: string }[]
}

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private readonly openRouter: OpenRouterService
  ) {}

  private SELECT_TITLE = {
    id: true,
    type: true,
    name: true,
    slug: true,
    coverUrl: true,
    releaseDate: true,
    rating: true,
    ratingCount: true
  }

  async getRecommendations(userId: string): Promise<AiSuggestionsResponse> {
    const taste = await this._buildTasteContext(userId)

    const payload = await this.openRouter.chatJson<IAiSuggestionsPayload>([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildRecommendationsPrompt(taste) }
    ])

    return { items: await this._matchWithLibrary(payload) }
  }

  /**
   * AI Picker. Работает и с пустым запросом: тогда подбор идёт
   * только по вкусу — кнопка «удиви меня»
   */
  async pick(userId: string, dto: PickerDto): Promise<AiSuggestionsResponse> {
    const [taste, exclude] = await Promise.all([
      this._buildTasteContext(userId),
      dto.excludeLibrary === false ? [] : this._getLibraryNames(userId)
    ])

    const payload = await this.openRouter.chatJson<IAiSuggestionsPayload>([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildPickerPrompt({
          mood: dto.mood ?? '',
          types: dto.type ?? [],
          duration: dto.duration,
          exclude,
          taste
        })
      }
    ])

    return { items: await this._matchWithLibrary(payload) }
  }

  /** Описание без спойлеров для детальной страницы */
  async getSpoilerFreeSummary(slug: string): Promise<AiSummaryResponse> {
    const title = await this.prisma.title.findUnique({
      where: { slug },
      select: { name: true, type: true }
    })

    if (!title) throw new NotFoundException('Title not found')

    const { summary } = await this.openRouter.chatJson<{ summary?: string }>([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildSpoilerFreePrompt(title.name, title.type)
      }
    ])

    return { summary: summary ?? '' }
  }

  // Приватные хелперы

  /** Названия из библиотеки, чтобы не предлагать уже знакомое */
  private async _getLibraryNames(userId: string): Promise<string[]> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      take: AI_EXCLUDE_LIMIT,
      orderBy: { updatedAt: 'desc' },
      select: { title: { select: { name: true } } }
    })

    return entries.map(({ title }) => title.name)
  }

  /** Что модель узнаёт о пользователе. В промпт уходит только это */
  private async _buildTasteContext(userId: string): Promise<ITasteContext> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      take: AI_TASTE_SAMPLE_SIZE * 3,
      orderBy: { updatedAt: 'desc' },
      select: {
        status: true,
        rating: true,
        title: {
          select: {
            name: true,
            type: true,
            genres: { select: { name: true } }
          }
        }
      }
    })

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
   * Модель возвращает названия текстом. Ищем их у себя, чтобы фронт мог
   * сразу открыть карточку; чего нет — отдаём как есть, клиент найдёт
   * это через /external/search.
   */
  private async _matchWithLibrary(
    payload: IAiSuggestionsPayload
  ): Promise<AiSuggestionResponse[]> {
    const items = (payload.items ?? [])
      .filter(item => item.name && this._isKnownType(item.type))
      .slice(0, AI_RECOMMENDATIONS_COUNT)

    return Promise.all(
      items.map(async item => ({
        name: item.name as string,
        type: item.type as TitleType,
        reason: item.reason ?? '',
        title: await this.prisma.title.findFirst({
          where: { name: { equals: item.name, mode: 'insensitive' } },
          select: this.SELECT_TITLE
        })
      }))
    )
  }

  private _isKnownType(type?: string): boolean {
    return Boolean(type && type in TitleType)
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
