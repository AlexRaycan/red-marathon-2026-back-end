import { Injectable } from '@nestjs/common'
import { AuthGuard, AuthModuleOptions } from '@nestjs/passport'

/**
 * Опции пробрасываем явно: без этого гуард не резолвится в модулях,
 * которые не импортируют PassportModule напрямую
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(options: AuthModuleOptions) {
    super(options)
  }
}
