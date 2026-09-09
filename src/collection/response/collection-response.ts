import { TitleListItemResponse } from '../../title/response/title-response'

export class CollectionOwnerResponse {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/** Карточка в списке — без самих тайтлов, только счётчик и обложки */
export class CollectionListItemResponse {
  id: string
  name: string
  slug: string
  description: string | null
  coverUrl: string | null
  isPublic: boolean
  titlesCount: number
  createdAt: Date
  updatedAt: Date
}

export class CollectionListResponse {
  items: CollectionListItemResponse[]
  isHasMore: boolean
}

export class CollectionResponse extends CollectionListItemResponse {
  titles: TitleListItemResponse[]
}

/** Публичная подборка по ссылке — с автором, но без приватных полей */
export class PublicCollectionResponse {
  name: string
  slug: string
  description: string | null
  coverUrl: string | null
  titlesCount: number
  titles: TitleListItemResponse[]
  owner: CollectionOwnerResponse
  createdAt: Date
}
