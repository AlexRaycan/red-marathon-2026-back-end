import { SubscriptionProvider } from '../../generated/prisma/enums'

/** Что стор рассказывает о покупке — общий формат для Apple и Google */
export interface IVerifiedPurchase {
  provider: SubscriptionProvider
  /** Сквозной id: по нему находим подписку, когда придёт вебхук */
  originalTransactionId: string
  productId: string
  purchaseToken: string
  expiresAt: Date | null
  isActive: boolean
  autoRenew: boolean
  isTrial: boolean
}

export interface IStoreProvider {
  readonly provider: SubscriptionProvider

  /** Проверяет покупку в API стора. Клиенту верить нельзя */
  verify(token: string): Promise<IVerifiedPurchase>
}
