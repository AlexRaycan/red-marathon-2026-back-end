import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import {
  ExternalSource,
  LibraryStatus,
  ProgressUnit,
  TitleType
} from '../../generated/prisma/enums'
import { ReviewResponse } from '../../review/response/review-response'
import {
  CreatorResponse,
  PersonResponse
} from '../../title/response/title-response'

/** Карточка тайтла из внешнего API — у нас в базе её может и не быть */
export class DiscoverItemResponse {
  /** Ключ для детальной страницы: `tmdb-movie-603`, `rawg-game-3328` */
  key: string
  externalId: string
  externalSource: ExternalSource
  type: TitleType
  name: string
  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null
  releaseDate: Date | null
  rating: number | null
  genres: string[]
}

/** Специфика типа; чего у тайтла нет — null */
export class TitleMetadataResponse {
  /** Длительность фильма, мин (TMDB movie) */
  @ApiPropertyOptional({ type: Number, nullable: true })
  runtimeMinutes?: number | null

  /** Число серий (TMDB tv, Shikimori) */
  @ApiPropertyOptional({ type: Number, nullable: true })
  episodeCount?: number | null

  /** Длительность серии, мин (Shikimori); у сериалов TMDB её нет */
  @ApiPropertyOptional({ type: Number, nullable: true })
  episodeRuntimeMinutes?: number | null

  /** Страницы книги (Google Books) */
  @ApiPropertyOptional({ type: Number, nullable: true })
  pageCount?: number | null

  /** Платформы игры (RAWG) */
  @ApiPropertyOptional({ type: [String], nullable: true })
  platforms?: string[] | null

  /** Оценка Metacritic, 0–100 (RAWG) */
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 100
  })
  metacritic?: number | null
}

/** Детальная страница целиком из внешнего API */
export class DiscoverDetailsResponse extends DiscoverItemResponse {
  originalName: string | null
  description: string | null
  ratingCount: number | null
  /** PG-13, TV-MA, M, R-17+ — у каждого источника своя система */
  ageRating: string | null
  /** Актёры — только у фильмов и сериалов, у остальных пустой список */
  cast: PersonResponse[]
  /** Режиссёр, автор идеи сериала, студия игры или аниме, автор книги */
  creators: CreatorResponse[]
  metadata: TitleMetadataResponse
  /** «You may also like» — приходит вместе со страницей, отдельный запрос не нужен */
  similar: DiscoverItemResponse[]
}

export class MyLibraryStatusResponse {
  id: string
  status: LibraryStatus
  progress: number | null
  progressUnit: ProgressUnit | null
}

/** Что текущий пользователь уже сделал с тайтлом витрины */
export class DiscoverMyStateResponse {
  libraryEntry: MyLibraryStatusResponse | null
  /** Включая приватный отзыв и оценку без текста */
  review: ReviewResponse | null
  /** Только коллекции текущего пользователя, включая приватные */
  collectionIds: string[]
}
