import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator'

import { SubscriptionProvider } from '../../generated/prisma/enums'

/**
 * Приложение шлёт сюда то, что получило от стора:
 * Apple — transactionId, Google — purchaseToken
 */
export class VerifyPurchaseDto {
  @IsEnum(SubscriptionProvider, { message: 'Unknown store provider' })
  readonly provider: SubscriptionProvider

  @IsString()
  @MinLength(4, { message: 'Invalid purchase token' })
  @MaxLength(4000, { message: 'Purchase token is too long' })
  readonly token: string
}
