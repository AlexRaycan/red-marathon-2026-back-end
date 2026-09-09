import { TitleListItemResponse } from '../../title/response/title-response'

export class ReviewAuthorResponse {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export class ReviewResponse {
  id: string
  rating: number
  text: string | null
  isPublic: boolean
  author: ReviewAuthorResponse
  createdAt: Date
  updatedAt: Date
}

export class ReviewListResponse {
  items: ReviewResponse[]
  isHasMore: boolean
}

/** Свой отзыв — с тайтлом, для списка «мои отзывы» */
export class MyReviewResponse extends ReviewResponse {
  title: TitleListItemResponse
}

export class MyReviewListResponse {
  items: MyReviewResponse[]
  isHasMore: boolean
}
