import { IsEnum, IsString, Matches } from 'class-validator'

import { PushPlatform } from '../../generated/prisma/enums'

export class PushTokenDto {
  /** Токен из expo-notifications: ExponentPushToken[xxxxxxxx] */
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$/, { message: 'Invalid push token' })
  readonly token: string

  @IsEnum(PushPlatform, { message: 'Unknown platform' })
  readonly platform: PushPlatform
}
