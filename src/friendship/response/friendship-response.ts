export class FriendResponse {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/** Заявка в друзья: from — кто отправил, to — кому */
export class FriendRequestResponse {
  id: string
  createdAt: Date
  user: FriendResponse
}

export class FriendListResponse {
  items: FriendResponse[]
  totalCount: number
}

export class FriendRequestListResponse {
  items: FriendRequestResponse[]
  totalCount: number
}
