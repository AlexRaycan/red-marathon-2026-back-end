export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/**
 * Бесплатная модель: 20 запросов в минуту, 50 в сутки без пополнения.
 * Для продакшена подойдёт qwen/qwen3.7-flash — задача простая,
 * рассуждающие модели тут не нужны. Цены: https://openrouter.ai/models
 */
export const OPENROUTER_MODEL = 'google/gemma-4-31b-it:free'

export const AI_REQUEST_TIMEOUT_MS = 30000

// Сколько тайтлов уходит в промпт: больше — дороже и медленнее
export const AI_TASTE_SAMPLE_SIZE = 15
export const AI_EXCLUDE_LIMIT = 40
export const AI_RECOMMENDATIONS_COUNT = 8

// Каждый запрос к модели платный, поэтому лимит жёстче общего
export const AI_RATE_LIMIT = 10
export const AI_RATE_TTL_MS = 60000
