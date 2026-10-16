import { Prisma } from '../generated/prisma/client'
import { toDiscoverKey } from '../utils/discover-key'

import { TitleListItemResponse } from './response/title-response'

export const TITLE_LIST_ITEM_SELECT = {
  id: true,
  type: true,
  name: true,
  slug: true,
  coverUrl: true,
  releaseDate: true,
  rating: true,
  ratingCount: true,
  externalSource: true,
  externalId: true
} satisfies Prisma.TitleSelect

type TTitleListItemRow = Prisma.TitleGetPayload<{
  select: typeof TITLE_LIST_ITEM_SELECT
}>

export function toTitleListItemResponse(
  title: TTitleListItemRow
): TitleListItemResponse {
  let key: string | null = null

  if (title.externalSource) {
    // Не отдаём null или некорректный ключ у импортированного тайтла
    if (!title.externalId) throw new Error('External title ID is missing')

    key = toDiscoverKey({
      source: title.externalSource,
      type: title.type,
      externalId: title.externalId
    })
  }

  return {
    id: title.id,
    key,
    type: title.type,
    name: title.name,
    slug: title.slug,
    coverUrl: title.coverUrl,
    releaseDate: title.releaseDate,
    rating: title.rating,
    ratingCount: title.ratingCount
  }
}
