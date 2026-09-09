import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { hash, verify } from 'argon2'
import { createHash, randomBytes, randomInt } from 'crypto'

import {
  DEVICE_CODE_LENGTH,
  DEVICE_CODE_POLL_INTERVAL_SEC,
  DEVICE_CODE_TTL_MS,
  JWT_ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS
} from '../constants/auth.constants'
import { User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { generateUsername } from '../utils/generate-username'

import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { MobileAuthResponse } from './response/auth-response'
import {
  DeviceCodeResponse,
  DevicePollResponse
} from './response/device-code-response'
import { ITokenData } from './interfaces/current-user.interface'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<MobileAuthResponse> {
    const email = dto.email.toLowerCase()

    await this._ensureEmailIsFree(email)

    const user = await this.prisma.user.create({
      data: {
        email,
        username: await this._generateUniqueUsername(),
        password: await hash(dto.password),
        profile: { create: {} }
      }
    })

    return this._issueTokens(user)
  }

  async login(dto: LoginDto): Promise<MobileAuthResponse> {
    const user = await this._validateUser(dto)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    return this._issueTokens(user)
  }

  async refresh(refreshToken: string): Promise<MobileAuthResponse> {
    if (!refreshToken) throw new UnauthorizedException('Token is missing')

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this._hashToken(refreshToken) },
      include: { user: true }
    })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid token')
    }

    // Ротация: старый токен гасим, выдаём новую пару
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    })

    return this._issueTokens(stored.user)
  }

  async logout(refreshToken: string): Promise<boolean> {
    if (!refreshToken) return true

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this._hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() }
    })

    return true
  }

  // Вход по коду для расширения (OAuth Device Flow)

  /** 1. Расширение просит код и показывает его пользователю */
  async createDeviceCode(): Promise<DeviceCodeResponse> {
    // Заодно убираем истёкшие коды, чтобы не занимали шестизначный диапазон
    await this.prisma.deviceCode.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    })

    const { code, expiresAt } = await this.prisma.deviceCode.create({
      data: {
        code: await this._generateUniqueDeviceCode(),
        expiresAt: new Date(Date.now() + DEVICE_CODE_TTL_MS)
      }
    })

    return { code, expiresAt, intervalSec: DEVICE_CODE_POLL_INTERVAL_SEC }
  }

  /** 2. Пользователь вводит код в вебе или мобилке, где уже авторизован */
  async approveDeviceCode(code: string, userId: string): Promise<boolean> {
    const deviceCode = await this.prisma.deviceCode.findUnique({
      where: { code }
    })

    if (!deviceCode || deviceCode.expiresAt < new Date()) {
      throw new BadRequestException('Code is invalid or expired')
    }

    if (deviceCode.approvedAt) {
      throw new BadRequestException('Code is already approved')
    }

    await this.prisma.deviceCode.update({
      where: { id: deviceCode.id },
      data: { approvedAt: new Date(), userId }
    })

    return true
  }

  /** 3. Расширение опрашивает эндпоинт и забирает токены после подтверждения */
  async pollDeviceCode(code: string): Promise<DevicePollResponse> {
    const deviceCode = await this.prisma.deviceCode.findUnique({
      where: { code },
      include: { user: true }
    })

    if (!deviceCode || deviceCode.expiresAt < new Date() || deviceCode.usedAt) {
      throw new BadRequestException('Code is invalid or expired')
    }

    if (!deviceCode.approvedAt || !deviceCode.user) {
      return { status: 'pending' }
    }

    // Токены отдаём один раз: сразу гасим код
    await this.prisma.deviceCode.update({
      where: { id: deviceCode.id },
      data: { usedAt: new Date() }
    })

    const auth = await this._issueTokens(deviceCode.user)

    return {
      status: 'approved',
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken
    }
  }

  // Приватные хелперы

  private async _validateUser(dto: LoginDto): Promise<User> {
    const email = dto.email.toLowerCase()

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    })

    // Одинаковое сообщение на несуществующий email и неверный пароль,
    // чтобы нельзя было перебором узнать, кто зарегистрирован
    if (!user || !(await verify(user.password, dto.password))) {
      throw new UnauthorizedException('Invalid email or password')
    }

    return user
  }

  private async _ensureEmailIsFree(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    })

    if (existing) throw new BadRequestException('Email is already taken')
  }

  /** Юзернейм при регистрации не спрашиваем — юзер поменяет его в профиле */
  private async _generateUniqueUsername(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = generateUsername()

      const existing = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true }
      })

      if (!existing) return username
    }

    return `user_${Date.now()}`
  }

  private async _issueTokens(user: User): Promise<MobileAuthResponse> {
    const payload: ITokenData = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    }

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: JWT_ACCESS_TOKEN_TTL
    })

    const refreshToken = randomBytes(32).toString('hex')

    // Храним хеш: утечка базы не даст войти в чужие аккаунты
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this._hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userId: user.id
      }
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  }

  private async _generateUniqueDeviceCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this._generateDeviceCode()

      const existing = await this.prisma.deviceCode.findUnique({
        where: { code },
        select: { id: true }
      })

      if (!existing) return code
    }

    throw new BadRequestException('Could not generate a code, please try again')
  }

  /** Формат 123-456 — вводится в поле из шести цифр */
  private _generateDeviceCode(): string {
    const digits = Array.from({ length: DEVICE_CODE_LENGTH }, () =>
      randomInt(10)
    ).join('')

    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  private _hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
