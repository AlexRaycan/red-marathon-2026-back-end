export const PORT = 4000

export const CLIENT_URL = 'http://localhost:3000'
export const EXPO_URL = 'http://localhost:8081'

export const DEFAULT_TAKE = 20
export const MAX_TAKE = 100

export const SEARCH_SUGGEST_TAKE = 8
export const SIMILAR_TAKE = 10

/**
 * Шкала для типа тайтла, когда у юзера выбран AUTO. Книги и игры привычнее
 * в пяти звёздах, кино и аниме — в десяти. Храним всегда по десятибалльной
 */
export const DEFAULT_RATING_SCALE_BY_TYPE = {
  MOVIE: 'TEN',
  TV_SHOW: 'TEN',
  ANIME: 'TEN',
  BOOK: 'FIVE',
  GAME: 'FIVE'
} as const

/** PRO снимает эти ограничения */
export const FREE_PLAN_LIMITS = {
  collections: 5,
  libraryEntries: 100,
  aiRequestsPerDay: 5
} as const

export const TRIAL_DAYS = 14

export const APPLE_STORE_API_URL =
  'https://api.storekit.itunes.apple.com/inApps/v1'
export const APPLE_SANDBOX_API_URL =
  'https://api.storekit-sandbox.itunes.apple.com/inApps/v1'

export const GOOGLE_PLAY_API_URL =
  'https://androidpublisher.googleapis.com/androidpublisher/v3'

export const STORE_REQUEST_TIMEOUT_MS = 10000
