import { Logger } from '@nestjs/common'

import {
  EXTERNAL_REQUEST_TIMEOUT_MS,
  EXTERNAL_UNAVAILABLE_PAUSE_MS
} from '../../constants/integration.constants'

interface IRequestOptions {
  method?: 'GET' | 'POST'
  body?: string
  headers?: Record<string, string>
}

// Хост → до какого момента к нему не ходим. Общий для всех провайдеров
const unavailableUntil = new Map<string, number>()

export abstract class BaseProvider {
  protected readonly logger = new Logger(this.constructor.name)

  protected fetchJson<T>(
    url: string,
    headers?: Record<string, string>
  ): Promise<T | null> {
    return this._request<T>(url, { headers })
  }

  /** POST с JSON-телом — нужен GraphQL-источникам (Shikimori) */
  protected postJson<T>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<T | null> {
    return this._request<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers }
    })
  }

  /**
   * Есть ли ресурс по ссылке — без скачивания тела. Редирект считаем ответом
   * «есть»: Open Library отдаёт обложку через 302 на архив, идти туда незачем
   */
  protected async exists(url: string): Promise<boolean> {
    const startedAt = Date.now()

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS)
      })

      const found = response.status >= 200 && response.status < 400

      // Отсутствующая обложка — обычный результат, сбой источника — нет.
      if (!found && response.status !== 404 && response.status !== 410) {
        this.logger.warn(
          `HEAD ${this._safeUrl(url)}: HTTP ${response.status} ${response.statusText} (${Date.now() - startedAt}ms)`
        )
      }

      return found
    } catch (error) {
      this.logger.error(
        `HEAD ${this._safeUrl(url)} failed (${Date.now() - startedAt}ms): ${this._safeDetails(this._errorDetails(error), url)}`
      )

      return false
    }
  }

  protected toDate(value?: string | null): Date | undefined {
    if (!value) return undefined

    const date = new Date(value)

    return isNaN(date.getTime()) ? undefined : date
  }

  /**
   * Внешний API не должен ронять наш запрос: если он недоступен,
   * возвращаем null и логируем — поиск просто не покажет этот источник.
   */
  private async _request<T>(
    url: string,
    { method, body, headers }: IRequestOptions
  ): Promise<T | null> {
    const { host } = new URL(url)

    if (this._isPaused(host)) return null

    const startedAt = Date.now()
    const request = `${method ?? 'GET'} ${this._safeUrl(url)}`

    try {
      const response = await fetch(url, {
        method,
        body,
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS)
      })

      if (!response.ok) {
        const details = this._safeDetails(await response.text(), url, headers)

        this.logger.error(
          `${request}: HTTP ${response.status} ${response.statusText} (${Date.now() - startedAt}ms): ${details || 'Empty error response'}`
        )

        return null
      }

      return (await response.json()) as T
    } catch (error) {
      // Запросы, начатые до первого сбоя, падают следом — пишем лог один раз
      if (!this._isPaused(host)) {
        this.logger.error(
          `${request} failed (${Date.now() - startedAt}ms, timeout ${EXTERNAL_REQUEST_TIMEOUT_MS}ms): ${this._safeDetails(this._errorDetails(error), url, headers)}; skipping ${host} for ${EXTERNAL_UNAVAILABLE_PAUSE_MS / 1000}s`
        )
      }

      unavailableUntil.set(host, Date.now() + EXTERNAL_UNAVAILABLE_PAUSE_MS)

      return null
    }
  }

  private _isPaused(host: string): boolean {
    return (unavailableUntil.get(host) ?? 0) > Date.now()
  }

  private _errorDetails(error: unknown): string {
    if (!(error instanceof Error)) return String(error)

    const cause = (error as Error & { cause?: unknown }).cause
    const details = `${error.name}: ${error.message}`

    if (!cause || typeof cause !== 'object') return details

    const { code, message } = cause as { code?: string; message?: string }

    return `${details}; cause: ${code ?? ''} ${message ?? ''}`.trim()
  }

  /** API иногда возвращает ключ в тексте ошибки — маскируем перед выводом. */
  private _safeDetails(
    details: string,
    url: string,
    headers?: Record<string, string>
  ): string {
    const secrets: string[] = []

    new URL(url).searchParams.forEach((value, key) => {
      if (/key|token|secret|password/i.test(key) && value) secrets.push(value)
    })
    Object.entries(headers ?? {}).forEach(([key, value]) => {
      if (/authorization|key|token|secret/i.test(key) && value) {
        secrets.push(value, value.replace(/^Bearer\s+/i, ''))
      }
    })

    for (const secret of secrets) {
      details = details.split(secret).join('[REDACTED]')
      details = details.split(encodeURIComponent(secret)).join('[REDACTED]')
    }

    return details.replace(/\s+/g, ' ').trim().slice(0, 2000)
  }

  /** В лог пишем хост и путь: по ним видно, какой источник упал. Ключ не логируем */
  private _safeUrl(url: string): string {
    const { host, pathname } = new URL(url)

    return `${host}${pathname}`
  }
}
