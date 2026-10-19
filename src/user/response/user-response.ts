import { UserRole } from '../../generated/prisma/enums'

export class ProfileResponse {
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  country: string | null
  birthDate: Date | null
  isPublic: boolean
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
