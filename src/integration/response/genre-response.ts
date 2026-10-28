import { ApiProperty } from '@nestjs/swagger'

import { GENRE_SLUGS } from '../../constants/genres.constants'

export class GenreResponse {
  /** Значение для параметра `genre` в GET /external/search */
  @ApiProperty({ enum: GENRE_SLUGS, enumName: 'GenreSlug' })
  slug: string
  label: string
}
