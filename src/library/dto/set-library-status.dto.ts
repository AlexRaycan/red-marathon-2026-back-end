import { PickType } from '@nestjs/swagger'

import { CreateLibraryEntryDto } from './create-library-entry.dto'

/** Без статуса новая запись попадает в PLANNED, а существующая не меняется */
export class SetLibraryStatusDto extends PickType(CreateLibraryEntryDto, [
  'status'
] as const) {}
