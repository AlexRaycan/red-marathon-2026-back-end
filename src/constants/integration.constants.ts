export const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w500'
// В касте бывают сотни человек — берём первых по порядку
export const TMDB_CAST_LIMIT = 15

export const RAWG_BASE_URL = 'https://api.rawg.io/api'

export const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1'
// Ширина обложки в пикселях: 800 хватает и на карточку, и на детальную
// страницу, а весит обложка ~100 КБ
export const GOOGLE_BOOKS_COVER_WIDTH = 800

// Shikimori отдаёт аниме без ключа, но требует осмысленный User-Agent.
// Домен переехал с shikimori.one — старый пока отвечает только редиректом
export const SHIKIMORI_GRAPHQL_URL = 'https://shikimori.io/api/graphql'
export const SHIKIMORI_USER_AGENT = 'RedMarathon'

export const EXTERNAL_SEARCH_TAKE = 10
export const EXTERNAL_REQUEST_TIMEOUT_MS = 8000

// Кеш поиска в памяти процесса: десять человек ищут одно и то же —
// наружу уходит один запрос
export const EXTERNAL_CACHE_TTL_MS = 5 * 60 * 1000
export const EXTERNAL_CACHE_MAX_ITEMS = 500
export const TITLE_DETAILS_CACHE_TTL_MS = 60 * 60 * 1000

// Тренды меняются медленно, а главную открывают чаще всего —
// держим их в кеше дольше поиска, чтобы не упираться в лимиты API
export const TRENDING_TAKE_PER_SOURCE = 20
export const TRENDING_CACHE_TTL_MS = 60 * 60 * 1000
export const DISCOVER_DEFAULT_TAKE = 20
export const DISCOVER_MAX_TAKE = 50

// Expo Push работает без ключей и без аккаунта Firebase
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
export const EXPO_PUSH_BATCH_SIZE = 100
