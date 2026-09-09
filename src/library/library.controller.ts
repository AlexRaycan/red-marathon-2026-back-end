import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { CreateLibraryEntryDto } from './dto/create-library-entry.dto'
import { LibraryQueryDto } from './dto/library-query.dto'
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto'
import { LibraryService } from './library.service'
import {
  LibraryEntryResponse,
  LibraryListResponse
} from './response/library-response'

@ApiTags('library')
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @Auth()
  @ApiOkResponse({ type: LibraryListResponse })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: LibraryQueryDto
  ): Promise<LibraryListResponse> {
    return this.libraryService.findAll(userId, query)
  }

  /** Есть ли тайтл в библиотеке — для кнопки на карточке и в расширении */
  @Get('by-title/:titleId')
  @Auth()
  @ApiOkResponse({ type: LibraryEntryResponse })
  findByTitle(
    @CurrentUser('id') userId: string,
    @Param('titleId') titleId: string
  ): Promise<LibraryEntryResponse | null> {
    return this.libraryService.findByTitle(userId, titleId)
  }

  @Post()
  @Auth()
  @ApiOkResponse({ type: LibraryEntryResponse })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLibraryEntryDto
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.create(userId, dto)
  }

  @Patch(':id')
  @Auth()
  @ApiOkResponse({ type: LibraryEntryResponse })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLibraryEntryDto
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.update(userId, id, dto)
  }

  @Delete(':id')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.libraryService.delete(userId, id)
  }
}
