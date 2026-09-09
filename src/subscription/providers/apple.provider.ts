import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as jwt from 'jsonwebtoken'

import {
  APPLE_SANDBOX_API_URL,
  APPLE_STORE_API_URL,
  STORE_REQUEST_TIMEOUT_MS
} from '../../constants/app.constants'
import { SubscriptionProvider } from '../../generated/prisma/enums'
import {
  IStoreProvider,
  IVerifiedPurchase
} from '../interfaces/store-provider.interface'

/**
 * Apple App Store Server API.
 * verifyReceipt устарел с 2023 года — используем /transactions/{id},
 * который отдаёт данные, подписанные Apple в формате JWS.
 * @see https://developer.apple.com/documentation/appstoreserverapi
 *
 * Пример payload внутри signedTransactionInfo:
 * {
 *   "originalTransactionId": "1000000123456789",
 *   "productId": "pro_monthly",
 *   "expiresDate": 1789123456000,
 *   "type": "Auto-Renewable Subscription",
 *   "offerType": 1
 * }
 */
interface IAppleTransactionResponse {
  signedTransactionInfo?: string
}

interface IAppleTransactionPayload {
  originalTransactionId?: string
  productId?: string
  expiresDate?: number
  offerType?: number
  revocationDate?: number
}

@Injectable()
export class AppleProvider implements IStoreProvider {
  readonly provider = SubscriptionProvider.APPLE

  private readonly logger = new Logger(AppleProvider.name)

  constructor(private readonly configService: ConfigService) {}

  async verify(transactionId: string): Promise<IVerifiedPurchase> {
    const data = await this._request<IAppleTransactionResponse>(
      `/transactions/${transactionId}`
    )

    if (!data?.signedTransactionInfo) {
      throw new BadRequestException('Transaction not found in the App Store')
    }

    // Apple подписывает данные сама, поэтому берём payload как есть:
    // сам факт ответа от их API и есть подтверждение подлинности
    const payload = this._decodeJws<IAppleTransactionPayload>(
      data.signedTransactionInfo
    )

    if (!payload?.originalTransactionId) {
      throw new BadRequestException('Invalid transaction data')
    }

    const expiresAt = payload.expiresDate ? new Date(payload.expiresDate) : null

    return {
      provider: this.provider,
      originalTransactionId: payload.originalTransactionId,
      productId: payload.productId ?? '',
      purchaseToken: transactionId,
      expiresAt,
      // Отозванная покупка (возврат средств) больше не даёт доступ
      isActive:
        !payload.revocationDate && (!expiresAt || expiresAt > new Date()),
      autoRenew: true,
      // offerType 1 — вводное предложение, то есть пробный период
      isTrial: payload.offerType === 1
    }
  }

  /** Разбирает JWS из вебхука: тело подписано Apple */
  decodeNotification<T>(signedPayload: string): T | null {
    return this._decodeJws<T>(signedPayload)
  }

  // Приватные хелперы

  private _decodeJws<T>(signed: string): T | null {
    try {
      return jwt.decode(signed) as T
    } catch (e) {
      this.logger.error('Не удалось разобрать JWS от Apple', e)

      return null
    }
  }

  private async _request<T>(path: string): Promise<T | null> {
    const isSandbox =
      this.configService.get<string>('APPLE_ENVIRONMENT') === 'sandbox'

    const baseUrl = isSandbox ? APPLE_SANDBOX_API_URL : APPLE_STORE_API_URL

    // Собираем токен до try: отсутствие ключей — это ошибка настройки,
    // а не сбой сети, и глотать её вместе с сетевыми нельзя
    const token = this._buildToken()

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(STORE_REQUEST_TIMEOUT_MS)
      })

      if (!response.ok) {
        this.logger.warn(`App Store ответил ${response.status} на ${path}`)

        return null
      }

      return (await response.json()) as T
    } catch (e) {
      this.logger.error('Ошибка запроса к App Store', e)

      return null
    }
  }

  /** Apple требует подписанный ES256-токен на каждый запрос */
  private _buildToken(): string {
    const keyId = this.configService.get<string>('APPLE_KEY_ID')
    const issuerId = this.configService.get<string>('APPLE_ISSUER_ID')
    const bundleId = this.configService.get<string>('APPLE_BUNDLE_ID')
    const rawKey = this.configService.get<string>('APPLE_PRIVATE_KEY')

    if (!keyId || !issuerId || !bundleId || !rawKey) {
      throw new ServiceUnavailableException('App Store is not configured')
    }

    const privateKey = rawKey.replace(/\\n/g, '\n')

    return jwt.sign(
      { iss: issuerId, aud: 'appstoreconnect-v1', bid: bundleId },
      privateKey,
      {
        algorithm: 'ES256',
        expiresIn: '1h',
        header: { alg: 'ES256', kid: keyId, typ: 'JWT' }
      }
    )
  }
}
