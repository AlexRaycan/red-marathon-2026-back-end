/**
 * Промпты на английском: продукт англоязычный. Каждый просит модель
 * вернуть чистый JSON описанной формы — парсер не поймёт лишний текст.
 * Названия просим точные и существующие: мы ищем их во внешних API
 * по имени и году и отбрасываем всё, что не нашлось.
 */

import {
  AI_EXTRA_CANDIDATES,
  AI_RECOMMENDATIONS_COUNT
} from '../../constants/ai.constants'
import { ITasteContext } from '../interfaces/ai.interface'

/** Общая роль модели во всех запросах */
export const SYSTEM_PROMPT = `
You are the recommendation engine of RED Marathon, a social app where people track movies, TV shows, anime, books and games in one library.

Rules:
- Suggest only real, existing titles you are certain about. Never invent a title.
- Use the exact original or official international title as it appears on TMDB, Shikimori, Google Books or RAWG, in Latin script: no translations, no subtitles you are unsure of, no edition names.
- Label each title with one type: MOVIE, TV_SHOW, ANIME, BOOK or GAME. Japanese animation is ANIME, a live-action series is TV_SHOW, a book is BOOK even if it has an adaptation.
- Give the year the title was first released (for a series — the year of its first episode).
- Write each reason as one sentence of at most 20 words that ties the title to this user's taste. No spoilers.
- Answer with a single JSON object and nothing else: no markdown, no comments.
`.trim()

const ITEMS_FORMAT = `
Return JSON:
{"items":[{"name":"...","type":"MOVIE|TV_SHOW|ANIME|BOOK|GAME","year":1999,"reason":"..."}]}
`.trim()

/**
 * Рекомендации по вкусу пользователя.
 * Ожидаемый ответ: { "items": [{ "name", "type", "year", "reason" }] }
 */
export const buildRecommendationsPrompt = (
  taste: ITasteContext,
  exclude: string[]
): string =>
  `
Suggest ${AI_RECOMMENDATIONS_COUNT + AI_EXTRA_CANDIDATES} titles this user is likely to enjoy next.

Guidelines:
- Match the genres, tone and quality level of what they rated highest; avoid what they would probably rate low.
- Mix types if the taste data shows interest in several; follow their main medium if it shows only one.
- At most one title per franchise or author, and no sequels to something they have not finished.
- If the taste data is empty, suggest widely acclaimed titles of different types.
${exclude.length ? `- They already know these, never suggest them: ${exclude.join(', ')}.` : ''}

User taste:
${JSON.stringify(taste, null, 2)}

${ITEMS_FORMAT}
`.trim()

/**
 * AI Picker — подбор под настроение.
 * Все параметры могут быть пустыми: тогда модель опирается только
 * на вкус пользователя («удиви меня»).
 * Ожидаемый ответ: { "items": [{ "name", "type", "year", "reason" }] }
 */
export const buildPickerPrompt = (options: IPickerPromptOptions): string => {
  const { mood, types, duration, exclude, taste } = options

  return `
Pick ${AI_RECOMMENDATIONS_COUNT + AI_EXTRA_CANDIDATES} titles for what the user wants right now. The request below matters more than their long-term taste; use the taste only to break ties.

${mood ? `Mood or request: "${mood}".` : 'No specific mood: surprise them with something they will probably love but would not find on their own.'}
${types.length ? `Only suggest these types: ${types.join(', ')}.` : 'Any type is fine.'}
${duration ? `Time they have: ${DURATION_HINTS[duration]}.` : ''}
${exclude.length ? `They already know these, never suggest them: ${exclude.join(', ')}.` : ''}

User taste:
${JSON.stringify(taste, null, 2)}

${ITEMS_FORMAT}
`.trim()
}

/** Подсказки длительности — модель понимает их лучше, чем «short» */
const DURATION_HINTS: Record<string, string> = {
  short:
    'short — a movie under 2 hours, a short book, or a game under 10 hours',
  medium:
    'medium length — a short series, a regular novel, or a 20-40 hour game',
  long: 'long — a multi-season series, a long book series, or a 60+ hour game'
}

export interface IPickerPromptOptions {
  mood: string
  types: string[]
  duration?: string
  /** Названия, которые уже есть у пользователя */
  exclude: string[]
  taste: ITasteContext
}

export interface ISpoilerFreePromptOptions {
  name: string
  type: string
  year: number | null
  genres: string[]
  /** Официальное описание из источника — опора для малоизвестных тайтлов */
  description: string | null
}

/**
 * Краткое описание без спойлеров для детальной страницы. Описание
 * из источника даём как опору: по нему модель не выдумывает сюжет
 * малоизвестного тайтла.
 * Ожидаемый ответ: { "summary": "..." }
 */
export const buildSpoilerFreePrompt = ({
  name,
  type,
  year,
  genres,
  description
}: ISpoilerFreePromptOptions): string =>
  `
Write a spoiler-free summary of "${name}" (${type}${year ? `, ${year}` : ''}${genres.length ? `, ${genres.join('/')}` : ''}).

Rules:
- 2-3 sentences, at most 60 words.
- Cover only the premise, setting and tone, nothing beyond the first act: no twists, no revelations, no endings, no character deaths, no who-is-who surprises.
- Do not compare it to other titles and do not praise it.
- Use the source description below as the reference and do not add plot facts that are not in it or that you are not sure about. If you do not recognise the title and there is no description, return an empty summary.
${description ? `\nSource description:\n${description}\n` : ''}
Return JSON:
{"summary":"..."}
`.trim()

/**
 * Одна-две фразы о вкусе для Taste DNA. Текст показывают и на
 * публичной странице, поэтому пишем в третьем лице.
 * Ожидаемый ответ: { "insight": "..." }
 */
export const buildTasteInsightPrompt = (taste: ITasteContext): string =>
  `
Describe this person's taste in 2 sentences, at most 45 words.

Rules:
- Third person without a name, like a short profile line ("Leans toward...").
- Point out patterns: dominant genres, the mix of media, what their ratings say (generous or picky). Name at most two titles.
- Be specific and honest, not flattering. Do not guess age, gender or personality.

Taste data:
${JSON.stringify(taste, null, 2)}

Return JSON:
{"insight":"..."}
`.trim()
