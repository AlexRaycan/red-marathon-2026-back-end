import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GoogleAuth } from 'google-auth-library'

import {
  GOOGLE_PLAY_API_URL,
  STORE_REQUEST_TIMEOUT_MS
} from '../../constants/app.constants'
import { SubscriptionProvider } from '../../generated/prisma/enums'
import {
  IStoreProvider,
  IVerifiedPurchase
} from '../interfaces/store-provider.interface'

/**
 * Google Play Developer API, purchases.subscriptionsv2.get.
 * @see https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
 *
 * Пример ответа:
 * {
 *   "subscriptionState": "SUBSCRIPTION_STATE_ACTIVE",
 *   "latestOrderId": "GPA.1234-5678-9012-34567",
 *   "lineItems": [{
 *     "productId": "pro_monthly",
 *     "expiryTime": "2026-10-04T12:00:00Z",
 *     "autoRenewingPlan": { "autoRenewEnabled": true }
 *   }]
 * }
 */
interface IGoogleSubscriptionResponse {
  subscriptionState?: string
  latestOrderId?: string
  linkedPurchaseToken?: string
  lineItems?: {
    productId?: string
    expiryTime?: string
    autoRenewingPlan?: { autoRenewEnabled?: boolean }
    offerDetails?: { offerId?: string }
  }[]
}

const ACTIVE_STATES = [
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
]

@Injectable()
export class GoogleProvider implements IStoreProvider {
  readonly provider = SubscriptionProvider.GOOGLE

  private readonly logger = new Logger(GoogleProvider.name)

  constructor(private readonly configService: ConfigService) {}

  async verify(purchaseToken: string): Promise<IVerifiedPurchase> {
    const packageName = this.configService.get<string>(
      'GOOGLE_PLAY_PACKAGE_NAME'
    )

    if (!packageName) {
      throw new ServiceUnavailableException('Google Play is not configured')
    }

    const data = await this._request<IGoogleSubscriptionResponse>(
      `/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`
    )

    if (!data?.subscriptionState) {
      throw new BadRequestException('Purchase not found in Google Play')
    }

    const [item] = data.lineItems ?? []

    const expiresAt = item?.expiryTime ? new Date(item.expiryTime) : null

    return {
      provider: this.provider,
      // При апгрейде тарифа Google выдаёт новый токен и связывает его
      // со старым — держимся за исходный, чтобы не потерять подписку
      originalTransactionId:
        data.linkedPurchaseToken ?? data.latestOrderId ?? purchaseToken,
      productId: item?.productId ?? '',
      purchaseToken,
      expiresAt,
      isActive: ACTIVE_STATES.includes(data.subscriptionState),
      autoRenew: item?.autoRenewingPlan?.autoRenewEnabled ?? false,
      isTrial: Boolean(item?.offerDetails?.offerId)
    }
  }

  // Приватные хелперы

  private async _request<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${GOOGLE_PLAY_API_URL}${path}`, {
        headers: { Authorization: `Bearer ${await this._getAccessToken()}` },
        signal: AbortSignal.timeout(STORE_REQUEST_TIMEOUT_MS)
      })

      if (!response.ok) {
        this.logger.warn(`Google Play ответил ${response.status}`)

        return null
      }

      return (await response.json()) as T
    } catch (e) {
      this.logger.error('Ошибка запроса к Google Play', e)

      return null
    }
  }

  /** Service account из Google Cloud, ключ лежит в переменной окружения */
  private async _getAccessToken(): Promise<string> {
    const raw = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON')

    if (!raw) {
      throw new ServiceUnavailableException('Google Play is not configured')
    }

    let credentials: Record<string, string>

    try {
      credentials = JSON.parse(raw) as Record<string, string>
    } catch {
      this.logger.error('GOOGLE_SERVICE_ACCOUNT_JSON не является валидным JSON')

      throw new ServiceUnavailableException('Google Play is not configured')
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    })

    const token = await auth.getAccessToken()

    if (!token) throw new BadRequestException('Google authorization failed')

    return token
  }
}
