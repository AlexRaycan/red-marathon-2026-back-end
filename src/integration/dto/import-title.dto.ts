import { IsEnum, IsString } from 'class-validator'

import { ExternalSource, TitleType } from '../../generated/prisma/enums'

export class ImportTitleDto {
  @IsEnum(ExternalSource, { message: 'Unknown source' })
  readonly source: ExternalSource

  @IsString()
  readonly externalId: string

  /** Часть ключа тайтла: у TMDB фильм и сериал с одним id — разные тайтлы */
  @IsEnum(TitleType, { message: 'Unknown title type' })
  readonly type: TitleType
}
