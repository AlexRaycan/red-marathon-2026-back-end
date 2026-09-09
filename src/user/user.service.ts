import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { hash, verify } from 'argon2'

import { DEFAULT_RATING_SCALE_BY_TYPE } from '../constants/app.constants'
import { LibraryStatus, RatingScale } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'

import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import {
  PublicProfileResponse,
  RatingScaleRuleResponse,
  TasteStatsResponse,
  UserResponse
} from './response/user-response'

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  private SELECT_PROFILE = {
    select: {
      displayName: true,
      bio: true,
      avatarUrl: true,
      country: true,
      birthDate: true,
      isPublic: true,
      ratingScale: true
    }
  }

  async findMe(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: this.SELECT_PROFILE }
    })

    if (!user) throw new NotFoundException('User not found')

    return this._toUserResponse(user)
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto
  ): Promise<UserResponse> {
    const { birthDate, ...rest } = dto

    const data = {
      ...rest,
      ...(birthDate ? { birthDate: new Date(birthDate) } : {})
    }

    // Профиль создаётся при регистрации, но upsert страхует от рассинхрона
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data
    })

    return this.findMe(userId)
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })

    if (!user || !(await verify(user.password, dto.oldPassword))) {
      throw new BadRequestException('Current password is incorrect')
    }

    // Меняем пароль и разлогиниваем все устройства разом
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: await hash(dto.newPassword) }
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ])

    return true
  }

  async deleteMe(userId: string): Promise<boolean> {
    await this.prisma.user.delete({ where: { id: userId } })

    return true
  }

  /**
   * Правило отображения оценок. Держим его на бэкенде, чтобы веб, мобилка
   * и расширение не дублировали одну и ту же таблицу у себя
   */
  async getRatingScaleRule(userId: string): Promise<RatingScaleRuleResponse> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { ratingScale: true }
    })

    const scale = profile?.ratingScale ?? RatingScale.AUTO

    const byType = Object.fromEntries(
      Object.entries(DEFAULT_RATING_SCALE_BY_TYPE).map(([type, auto]) => [
        type,
        scale === RatingScale.AUTO ? auto : scale
      ])
    )

    return { scale, byType }
  }

  /** Публичный Taste DNA по ссылке — работает без авторизации */
  async findPublicByUsername(username: string): Promise<PublicProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { profile: this.SELECT_PROFILE }
    })

    // Закрытый профиль отдаём как 404: иначе по коду ответа
    // можно перебором узнать, кто зарегистрирован
    if (!user?.profile?.isPublic) {
      throw new NotFoundException('Profile not found')
    }

    return {
      username: user.username,
      displayName: user.profile.displayName,
      bio: user.profile.bio,
      avatarUrl: user.profile.avatarUrl,
      country: user.profile.country,
      createdAt: user.createdAt,
      taste: await this.getTasteStats(user.id)
    }
  }

  /** Вкусовой профиль: из чего складывается библиотека пользователя */
  async getTasteStats(userId: string): Promise<TasteStatsResponse> {
    const [byStatus, aggregate, byType, favoriteGenres] = await Promise.all([
      this.prisma.libraryEntry.groupBy({
        by: ['status'],
        where: { userId },
        _count: true
      }),
      this.prisma.libraryEntry.aggregate({
        where: { userId },
        _count: true,
        _avg: { rating: true }
      }),
      this._getCountsByType(userId),
      this._getFavoriteGenres(userId)
    ])

    return {
      byType,
      byStatus: Object.fromEntries(
        byStatus.map(({ status, _count }) => [status, _count])
      ),
      totalEntries: aggregate._count,
      completedCount:
        byStatus.find(({ status }) => status === LibraryStatus.COMPLETED)
          ?._count ?? 0,
      averageRating: aggregate._avg.rating,
      favoriteGenres
    }
  }

  // Приватные хелперы

  private async _getCountsByType(
    userId: string
  ): Promise<Record<string, number>> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      select: { title: { select: { type: true } } }
    })

    return entries.reduce<Record<string, number>>((acc, { title }) => {
      acc[title.type] = (acc[title.type] ?? 0) + 1

      return acc
    }, {})
  }

  /** Топ-5 жанров по числу тайтлов в библиотеке */
  private async _getFavoriteGenres(userId: string): Promise<string[]> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      select: { title: { select: { genres: { select: { name: true } } } } }
    })

    const counts = entries.reduce<Record<string, number>>((acc, { title }) => {
      title.genres.forEach(({ name }) => {
        acc[name] = (acc[name] ?? 0) + 1
      })

      return acc
    }, {})

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name)
  }

  private _toUserResponse(user: {
    id: string
    email: string
    username: string
    role: UserResponse['role']
    isVerified: boolean
    createdAt: Date
    profile: UserResponse['profile']
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isVerified: user.isVerified,
      profile: user.profile,
      createdAt: user.createdAt
    }
  }
}
