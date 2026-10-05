import { LibraryStatus, ProgressUnit } from '../../generated/prisma/enums'
import { TitleListItemResponse } from '../../title/response/title-response'

export class LibraryEntryResponse {
  id: string
  status: LibraryStatus
  progress: number | null
  progressUnit: ProgressUnit | null
  /** Оценка из отзыва пользователя на этот тайтл — в библиотеке её нет */
  rating: number | null
  note: string | null
  isFavorite: boolean
  startedAt: Date | null
  finishedAt: Date | null
  title: TitleListItemResponse
  createdAt: Date
  updatedAt: Date
}

export class LibraryListResponse {
  items: LibraryEntryResponse[]
  isHasMore: boolean
}
