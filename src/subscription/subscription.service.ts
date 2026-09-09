import { BadRequestException, Injectable, Logger } from '@nestjs/common'

import { FREE_PLAN_LIMITS, TRIAL_DAYS } from '../constants/app.constants'
import {
  SubscriptionPlan,
  SubscriptionProvider,
  SubscriptionStatus
} from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'

import { VerifyPurchaseDto } from './dto/verify-purchase.dto'
import { IVerifiedPurchase } from './interfaces/store-provider.interface'
import { AppleProvider } from './providers/apple.provider'
import { GoogleProvider } from './providers/google.provider'
import { SubscriptionResponse } from './response/subscription-response'

const ACTIVE_STATUSES = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name)

  constructor(
    private prisma: PrismaService,
    private readonly appleProvider: AppleProvider,
    private readonly googleProvider: GoogleProvider
  ) {}

  async findMy(userId: string): Promise<SubscriptionResponse> {
    const subscription = await this._getCurrent(userId)

    const [collections, libraryEntries] = await Promise.all([
      this.prisma.collection.count({ where: { userId } }),
      this.prisma.libraryEntry.count({ where: { userId } })
    ])

    const isPro = this._isProActive(subscription)

    return {
      plan: subscription?.plan ?? SubscriptionPlan.FREE,
      status: subscription?.status ?? SubscriptionStatus.ACTIVE,
      startsAt: subscription?.startsAt ?? new Date(),
      endsAt: subscription?.endsAt ?? null,
      canceledAt: subscription?.canceledAt ?? null,
      autoRenew: subscription?.autoRenew ?? false,
      isActive: isPro,
      limits: isPro
        ? { collections: null, libraryEntries: null, aiRequestsPerDay: null }
        : { ...FREE_PLAN_LIMITS },
      usage: { collections, libraryEntries }
    }
  }

  /** Пробный период — оплата подключается позже */
  async startTrial(userId: string): Promise<SubscriptionResponse> {
    const existing = await this._getCurrent(userId)

    if (existing && existing.plan === SubscriptionPlan.PRO) {
      throw new BadRequestException('You already have an active subscription')
    }

    // Триал даётся один раз: смотрим всю историю, а не только активные
    const hadTrial = await this.prisma.subscription.findFirst({
      where: { userId },
      select: { id: true }
    })

    if (hadTrial) throw new BadRequestException('Trial has already been used')

    const endsAt = new Date()
    endsAt.setDate(endsAt.getDate() + TRIAL_DAYS)

    await this.prisma.subscription.create({
      data: {
        userId,
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.TRIALING,
        endsAt,
        autoRenew: false
      }
    })

    return this.findMy(userId)
  }

  async cancel(userId: string): Promise<SubscriptionResponse> {
    const subscription = await this._getCurrent(userId)

    if (!subscription || subscription.plan === SubscriptionPlan.FREE) {
      throw new BadRequestException('You have no active subscription')
    }

    if (subscription.canceledAt) {
      throw new BadRequestException('Subscription is already canceled')
    }

    // Не обрываем сразу: доступ остаётся до конца оплаченного периода
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { canceledAt: new Date(), autoRenew: false }
    })

    return this.findMy(userId)
  }

  /**
   * Проверяет покупку в сторе и включает PRO.
   * Токену от клиента не верим — сверяемся с Apple или Google
   */
  async verifyPurchase(
    userId: string,
    dto: VerifyPurchaseDto
  ): Promise<SubscriptionResponse> {
    const provider =
      dto.provider === SubscriptionProvider.APPLE
        ? this.appleProvider
        : this.googleProvider

    const purchase = await provider.verify(dto.token)

    if (!purchase.isActive) {
      throw new BadRequestException('Purchase is not active')
    }

    await this._upsertFromPurchase(userId, purchase)

    return this.findMy(userId)
  }

  /**
   * Обновление статуса из вебхука стора. Пользователь тут не участвует —
   * подписку находим по originalTransactionId
   */
  async applyStoreUpdate(purchase: IVerifiedPurchase): Promise<void> {
    const existing = await this.prisma.subscription.findUnique({
      where: { originalTransactionId: purchase.originalTransactionId },
      select: { id: true }
    })

    // Покупка, которой у нас нет: юзер ещё не позвал verify.
    // Не создаём запись вслепую — привязать её не к кому
    if (!existing) {
      this.logger.warn(
        `Вебхук по неизвестной покупке ${purchase.originalTransactionId}`
      )

      return
    }

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: this._getStatus(purchase),
        endsAt: purchase.expiresAt,
        autoRenew: purchase.autoRenew,
        purchaseToken: purchase.purchaseToken,
        lastVerifiedAt: new Date()
      }
    })
  }

  /** Используется другими доменами перед проверкой лимитов */
  async isProActive(userId: string): Promise<boolean> {
    return this._isProActive(await this._getCurrent(userId))
  }

  // Приватные хелперы

  private async _upsertFromPurchase(
    userId: string,
    purchase: IVerifiedPurchase
  ): Promise<void> {
    const data = {
      plan: SubscriptionPlan.PRO,
      status: this._getStatus(purchase),
      provider: purchase.provider,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
      endsAt: purchase.expiresAt,
      autoRenew: purchase.autoRenew,
      canceledAt: null,
      lastVerifiedAt: new Date()
    }

    // Одна и та же покупка может прийти повторно — например,
    // при восстановлении на новом устройстве
    await this.prisma.subscription.upsert({
      where: { originalTransactionId: purchase.originalTransactionId },
      create: {
        ...data,
        userId,
        originalTransactionId: purchase.originalTransactionId
      },
      update: data
    })
  }

  private _getStatus(purchase: IVerifiedPurchase): SubscriptionStatus {
    if (!purchase.isActive) return SubscriptionStatus.EXPIRED

    return purchase.isTrial
      ? SubscriptionStatus.TRIALING
      : SubscriptionStatus.ACTIVE
  }

  private async _getCurrent(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' }
    })
  }

  /** Подписка активна, пока не истёк срок — даже если её отменили */
  private _isProActive(
    subscription: {
      plan: SubscriptionPlan
      endsAt: Date | null
    } | null
  ): boolean {
    if (!subscription || subscription.plan !== SubscriptionPlan.PRO)
      return false

    return !subscription.endsAt || subscription.endsAt > new Date()
  }
}
