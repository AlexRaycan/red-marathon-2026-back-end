import { Logger } from '@nestjs/common'

import { EXTERNAL_REQUEST_TIMEOUT_MS } from '../../constants/integration.constants'

export abstract class BaseProvider {
  protected readonly logger = new Logger(this.constructor.name)

  /**
   * Внешний API не должен ронять наш запрос: если он недоступен,
   * возвращаем null и логируем — поиск просто не покажет этот источник.
   */
  protected async fetchJson<T>(
    url: string,
    headers?: Record<string, string>
  ): Promise<T | null> {
    try {
      const response = await fetch(url, {
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

  protected toDate(value?: string | null): Date | undefined {
    if (!value) return undefined

    const date = new Date(value)

    return isNaN(date.getTime()) ? undefined : date
  }

  /** В лог пишем хост и путь: по ним видно, какой источник упал. Ключ не логируем */
  private _safeUrl(url: string): string {
    const { host, pathname } = new URL(url)

    return `${host}${pathname}`
  }
}
