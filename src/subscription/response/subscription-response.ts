import {
  SubscriptionPlan,
  SubscriptionStatus
} from '../../generated/prisma/enums'

export class SubscriptionLimitsResponse {
  /** null означает «без ограничений» */
  collections: number | null
  libraryEntries: number | null
  aiRequestsPerDay: number | null
}

export class SubscriptionUsageResponse {
  collections: number
  libraryEntries: number
}

export class SubscriptionResponse {
  plan: SubscriptionPlan
  status: SubscriptionStatus
  startsAt: Date
  endsAt: Date | null
  canceledAt: Date | null
  autoRenew: boolean
  /** Активна ли подписка прямо сейчас */
  isActive: boolean
  limits: SubscriptionLimitsResponse
  usage: SubscriptionUsageResponse
}
