import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from '@nestjs/common'

import {
  AI_MAX_TOKENS,
  AI_REQUEST_TIMEOUT_MS,
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL
} from '../constants/ai.constants'

import {
  IChatCompletionResponse,
  IChatMessage
} from './interfaces/ai.interface'

/**
 * Клиент OpenRouter. Он совместим с OpenAI API, поэтому при желании
 * меняется на любого другого провайдера сменой baseURL.
 * @see https://openrouter.ai/docs
 */
@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name)

  constructor(private readonly configService: ConfigService) {}

  /** Свободный ответ текстом. `purpose` попадает в лог расхода токенов */
  async chat(
    messages: IChatMessage[],
    purpose: string,
    asJson = false
  ): Promise<string> {
    const data = await this._request(messages, asJson)

    // Расход токенов пишем на каждый вызов, чтобы посчитать реальную цену
    this.logger.log(
      `${purpose}: tokens in=${data.usage?.prompt_tokens ?? '?'} out=${data.usage?.completion_tokens ?? '?'}`
    )

    const content = data.choices?.[0]?.message?.content

    if (!content)
      throw new ServiceUnavailableException('AI service is unavailable')

    return content.trim()
  }

  /**
   * Ответ, разобранный в объект. Модели любят оборачивать JSON
   * в markdown-блок, поэтому чистим перед разбором.
   */
  async chatJson<T>(messages: IChatMessage[], purpose: string): Promise<T> {
    const content = await this.chat(messages, purpose, true)

    try {
      return JSON.parse(this._extractJson(content)) as T
    } catch {
      this.logger.error(`Модель вернула не JSON: ${content.slice(0, 200)}`)

      throw new ServiceUnavailableException(
        'AI returned an unexpected response'
      )
    }
  }

  // Приватные хелперы

  private async _request(
    messages: IChatMessage[],
    asJson = false
  ): Promise<IChatCompletionResponse> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY')

    if (!apiKey) {
      throw new ServiceUnavailableException('AI service is not configured')
    }

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages,
          max_tokens: AI_MAX_TOKENS,
          // Модель не сможет обернуть JSON в markdown или текст.
          // Поддерживают не все модели — отсюда запасной парсер ниже
          ...(asJson ? { response_format: { type: 'json_object' } } : {})
        }),
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)
      })

      const data = (await response.json()) as IChatCompletionResponse

      if (!response.ok || data.error) {
        this.logger.error(
          `OpenRouter ${response.status}: ${data.error?.message ?? 'unknown'}`
        )

        throw new ServiceUnavailableException('AI service is unavailable')
      }

      return data
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e

      this.logger.error('Ошибка запроса к OpenRouter', e)

      throw new ServiceUnavailableException('AI service is unavailable')
    }
  }

  private _extractJson(content: string): string {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)

    return (fenced?.[1] ?? content).trim()
  }
}
