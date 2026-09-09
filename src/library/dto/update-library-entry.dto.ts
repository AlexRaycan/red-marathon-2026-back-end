import { OmitType, PartialType } from '@nestjs/swagger'

import { CreateLibraryEntryDto } from './create-library-entry.dto'

/** titleId менять нельзя — это другая запись */
export class UpdateLibraryEntryDto extends PartialType(
  OmitType(CreateLibraryEntryDto, ['titleId'] as const)
) {}
