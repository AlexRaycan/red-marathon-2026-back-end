import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { PrismaService } from '../../prisma/prisma.service'
import { ICurrentUser, ITokenData } from '../interfaces/current-user.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET')
    })
  }

  // Ходим в базу, чтобы удалённый или разжалованный юзер
  // не продолжал работать по старому токену
  async validate(payload: ITokenData): Promise<ICurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, username: true, role: true }
    })

    if (!user) throw new UnauthorizedException('User not found')

    return user
  }
}
