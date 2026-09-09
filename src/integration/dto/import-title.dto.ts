import { IsEnum, IsOptional, IsString } from 'class-validator'

import { ExternalSource, TitleType } from '../../generated/prisma/enums'

export class ImportTitleDto {
  @IsEnum(ExternalSource, { message: 'Unknown source' })
  readonly source: ExternalSource

  @IsString()
  readonly externalId: string

  /** TMDB отдаёт фильмы и сериалы по разным путям — тип нужен ему */
  @IsOptional()
  @IsEnum(TitleType, { message: 'Unknown title type' })
  readonly type?: TitleType
}
