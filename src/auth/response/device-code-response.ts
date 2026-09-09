export class DeviceCodeResponse {
  /** Шесть цифр в формате 123-456 */
  code: string
  expiresAt: Date
  /** Через сколько секунд опрашивать /auth/device/poll */
  intervalSec: number
}

export class DevicePollResponse {
  status: 'pending' | 'approved'
  accessToken?: string
  refreshToken?: string
}
