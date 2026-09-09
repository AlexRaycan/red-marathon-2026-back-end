import { RatingScale, UserRole } from '../../generated/prisma/enums'

export class ProfileResponse {
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  country: string | null
  birthDate: Date | null
  isPublic: boolean
  /**
   * Как показывать оценки. Хранятся всегда по 10-балльной шкале.
   * AUTO — шкала выбирается по типу тайтла, см. /users/me/rating-scales
   */
  ratingScale: RatingScale
}

/** Полные данные для владельца аккаунта */
export class UserResponse {
  id: string
  email: string
  username: string
  role: UserRole
  isVerified: boolean
  profile: ProfileResponse | null
  createdAt: Date
}

export class TasteStatsResponse {
  /** Сколько тайтлов в библиотеке по каждому типу */
  byType: Record<string, number>
  /** Сколько записей в каждом статусе */
  byStatus: Record<string, number>
  totalEntries: number
  completedCount: number
  averageRating: number | null
  favoriteGenres: string[]
}

/** Публичный Taste DNA — открывается по ссылке без авторизации */
export class PublicProfileResponse {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  country: string | null
  createdAt: Date
  taste: TasteStatsResponse
}

/**
 * Правило отображения оценок для клиентов. Оценки в API всегда
 * десятибалльные — клиент делит на 2, когда показывает пятибалльную.
 */
export class RatingScaleRuleResponse {
  /** Что выбрал пользователь */
  scale: RatingScale
  /** Какую шкалу показывать для каждого типа при текущей настройке */
  byType: Record<string, 'FIVE' | 'TEN'>
}
