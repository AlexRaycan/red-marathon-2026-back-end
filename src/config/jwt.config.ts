import { ConfigService } from '@nestjs/config'
import { JwtModuleOptions } from '@nestjs/jwt'

import { JWT_ACCESS_TOKEN_TTL } from '../constants/auth.constants'

export const getJwtConfig = (
  configService: ConfigService
): JwtModuleOptions => ({
  secret: configService.getOrThrow<string>('JWT_SECRET'),
  signOptions: { expiresIn: JWT_ACCESS_TOKEN_TTL }
})
