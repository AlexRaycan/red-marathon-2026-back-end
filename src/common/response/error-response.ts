/**
 * Единый формат ошибки для всех эндпоинтов.
 * Фронтенд всегда получает одну и ту же форму — и для ошибок валидации,
 * и для брошенных исключений.
 */
export class ErrorResponse {
  statusCode: number
  message: string | string[]
  error: string
  path: string
  timestamp: string
}
