import { UserRole } from '../../generated/prisma/enums'

export class AuthUserResponse {
  id: string
  email: string
  username: string
  role: UserRole
}

/** Ответ для веба: refresh уходит в httpOnly-куке, в теле его нет */
export class AuthResponse {
  user: AuthUserResponse
  accessToken: string
}

/** Ответ для мобильного приложения и расширения: куки им недоступны */
export class MobileAuthResponse extends AuthResponse {
  refreshToken: string
}
