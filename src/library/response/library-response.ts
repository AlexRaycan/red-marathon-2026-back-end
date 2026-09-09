import { LibraryStatus, ProgressUnit } from '../../generated/prisma/enums'
import { TitleListItemResponse } from '../../title/response/title-response'

export class LibraryEntryResponse {
  id: string
  status: LibraryStatus
  progress: number | null
  progressUnit: ProgressUnit | null
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
