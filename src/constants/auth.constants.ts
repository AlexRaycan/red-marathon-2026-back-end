export const JWT_ACCESS_TOKEN_TTL = '1h'

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const REFRESH_TOKEN_NAME = 'refreshToken'

export const AUTH_RATE_TTL_MS = 60_000
export const LOGIN_RATE_LIMIT = 10
export const REGISTER_RATE_LIMIT = 5

// Код для расширения живёт недолго — его вводят сразу
export const DEVICE_CODE_TTL_MS = 10 * 60 * 1000
export const DEVICE_CODE_POLL_INTERVAL_SEC = 3
export const DEVICE_CODE_LENGTH = 6
