export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/**
 * Claude Haiku 5.5 через OpenRouter: задача простая (вспомнить похожие
 * тайтлы и вернуть JSON), рассуждающая модель тут не нужна.
 * Параметры сэмплирования (temperature, top_p) не передаём — Haiku 5.5
 * отвечает на них ошибкой, как и на префилл ответа ассистента.
 * Цены: https://openrouter.ai/anthropic/claude-haiku-5.5
 */
export const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5'

export const AI_REQUEST_TIMEOUT_MS = 30000

// Потолок на ответ: обычный ответ — сотни токенов, остальное запас
// на случай, если модель уйдёт в долгие рассуждения
export const AI_MAX_TOKENS = 4096

// Сколько тайтлов уходит в промпт: больше — дороже и медленнее
export const AI_TASTE_SAMPLE_SIZE = 15
export const AI_EXCLUDE_LIMIT = 40
// Сколько тайтлов библиотеки сверяем с ответом модели, чтобы не показать знакомое
export const AI_LIBRARY_KEYS_LIMIT = 500
export const AI_RECOMMENDATIONS_COUNT = 8
// Часть названий не находится во внешних API — просим с запасом
export const AI_EXTRA_CANDIDATES = 2

export const AI_CACHE_MAX_ITEMS = 1000
export const AI_RECOMMENDATIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const AI_TASTE_INSIGHT_TTL_MS = 7 * 24 * 60 * 60 * 1000
// Окно, за которое считаем запросы к платным ручкам
export const AI_USAGE_WINDOW_MS = 24 * 60 * 60 * 1000

// Каждый запрос к модели платный, поэтому лимит жёстче общего
export const AI_RATE_LIMIT = 10
export const AI_RATE_TTL_MS = 60000
