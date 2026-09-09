import { Injectable, Logger } from '@nestjs/common'

import {
  EXPO_PUSH_BATCH_SIZE,
  EXPO_PUSH_URL
} from '../constants/integration.constants'
import { PrismaService } from '../prisma/prisma.service'

import { PushTokenDto } from './dto/push-token.dto'

interface IExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Пуши на телефон через Expo Push API — ключи и аккаунт Firebase не нужны.
 * Токен приложение получает через expo-notifications и присылает сюда.
 * @see https://docs.expo.dev/push-notifications/sending-notifications
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)

  constructor(private prisma: PrismaService) {}

  /** Один токен — одно устройство, при переустановке приложения он меняется */
  async register(userId: string, dto: PushTokenDto): Promise<boolean> {
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform },
      create: { ...dto, userId }
    })

    return true
  }

  async unregister(userId: string, token: string): Promise<boolean> {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } })

    return true
  }

  /**
   * Отправка не должна ронять основной запрос: если Expo недоступен,
   * уведомление всё равно останется в базе и человек увидит его в списке
   */
  async send(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    if (!userIds.length) return

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true }
    })

    if (!tokens.length) return

    const messages = tokens.map(({ token }) => ({
      to: token,
      title,
      body,
      data
    }))

    for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_SIZE) {
      await this._send(messages.slice(i, i + EXPO_PUSH_BATCH_SIZE))
    }
  }

  private async _send(messages: IExpoMessage[]): Promise<void> {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages)
      })

      if (!response.ok) {
        this.logger.warn(`Expo push failed: ${response.status}`)
      }
    } catch (error) {
      this.logger.warn(`Expo push failed: ${String(error)}`)
    }
  }
}
