import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'

import { LibraryStatus } from '../../generated/prisma/enums'

import { ImportTitleDto } from './import-title.dto'

/**
 * Добавление в один клик из браузерного расширения:
 * импортируем тайтл и сразу кладём в библиотеку одним запросом.
 */
export class QuickAddDto extends ImportTitleDto {
  @IsOptional()
  @IsEnum(LibraryStatus, { message: 'Unknown status' })
  readonly status?: LibraryStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 10' })
  @Max(10, { message: 'Rating must be between 1 and 10' })
  readonly rating?: number
}
