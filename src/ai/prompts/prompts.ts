/**
 * ─────────────────────────────────────────────────────────────────────
 *  ПРОМПТЫ ПИШЕТ ВЛАДЕЛЕЦ ПРОЕКТА
 *
 *  Ниже — рабочие заглушки, чтобы код собирался и запускался.
 *  Замени тексты на свои: качество выдачи зависит именно от них,
 *  а не от кода вокруг.
 *
 *  Требования, которые нельзя нарушать при переписывании:
 *   1. Модель обязана вернуть ЧИСТЫЙ JSON описанной формы —
 *      парсер не поймёт лишний текст вокруг.
 *   2. Промпты на английском: продукт англоязычный.
 *   3. В рекомендациях просим существующие тайтлы, а не выдуманные:
 *      мы ищем их во внешних API по названию.
 * ─────────────────────────────────────────────────────────────────────
 */

import { AI_RECOMMENDATIONS_COUNT } from '../../constants/ai.constants'
import { ITasteContext } from '../interfaces/ai.interface'

/** Общая роль модели во всех запросах */
export const SYSTEM_PROMPT = `
[TODO: твой системный промпт]

You are a recommendation assistant for a media library app covering movies,
TV shows, anime, books and games. Answer only with valid JSON, no markdown.
`.trim()

/**
 * Рекомендации по вкусу пользователя.
 * Ожидаемый ответ: { "items": [{ "name", "type", "reason" }] }
 */
export const buildRecommendationsPrompt = (taste: ITasteContext): string =>
  `
[TODO: твой промпт для рекомендаций]

Suggest ${AI_RECOMMENDATIONS_COUNT} real, existing titles this user is likely
to enjoy. Do not repeat titles they already have.

User taste:
${JSON.stringify(taste, null, 2)}

Return JSON:
{"items":[{"name":"...","type":"MOVIE|TV_SHOW|ANIME|BOOK|GAME","reason":"one short sentence"}]}
`.trim()

/**
 * AI Picker — подбор под настроение.
 * Все параметры могут быть пустыми: тогда модель опирается только
 * на вкус пользователя («удиви меня»).
 * Ожидаемый ответ: { "items": [{ "name", "type", "reason" }] }
 */
export const buildPickerPrompt = (options: IPickerPromptOptions): string => {
  const { mood, types, duration, exclude, taste } = options

  return `
[TODO: твой промпт для AI Picker]

${mood ? `The user is in this mood: "${mood}".` : 'The user has no specific mood in mind — surprise them based on their taste.'}
${types.length ? `Only suggest these types: ${types.join(', ')}.` : ''}
${duration ? `They want something ${DURATION_HINTS[duration]}.` : ''}
${exclude.length ? `Never suggest these, they already know them: ${exclude.join(', ')}.` : ''}

User taste:
${JSON.stringify(taste, null, 2)}

Return JSON:
{"items":[{"name":"...","type":"MOVIE|TV_SHOW|ANIME|BOOK|GAME","reason":"one short sentence"}]}
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

/**
 * Краткое описание без спойлеров для детальной страницы.
 * Ожидаемый ответ: { "summary": "..." }
 */
export const buildSpoilerFreePrompt = (name: string, type: string): string =>
  `
[TODO: твой промпт для описания без спойлеров]

Write a spoiler-free summary of "${name}" (${type}) in 2-3 sentences.

Return JSON:
{"summary":"..."}
`.trim()
