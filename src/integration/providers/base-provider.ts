import { Logger } from '@nestjs/common'

import { EXTERNAL_REQUEST_TIMEOUT_MS } from '../../constants/integration.constants'

interface IRequestOptions {
  method?: 'GET' | 'POST'
  body?: string
  headers?: Record<string, string>
}

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
    try {
      const response = await fetch(url, {
        method,
        body,
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS)
      })

      if (!response.ok) {
        this.logger.warn(`${response.status} от ${this._safeUrl(url)}`)

        return null
      }

      return (await response.json()) as T
    } catch (e) {
      this.logger.error(`Ошибка запроса к ${this._safeUrl(url)}`, e)

      return null
    }
  }

  /** В лог пишем хост и путь: по ним видно, какой источник упал. Ключ не логируем */
  private _safeUrl(url: string): string {
    const { host, pathname } = new URL(url)

    return `${host}${pathname}`
  }
}
