import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query
} from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { LibraryQueryDto } from './dto/library-query.dto'
import { SetLibraryStatusDto } from './dto/set-library-status.dto'
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
  @ApiOperation({ operationId: 'libraryTitles' })
  @Auth()
  @ApiOkResponse({ type: LibraryListResponse })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: LibraryQueryDto
  ): Promise<LibraryListResponse> {
    return this.libraryService.findAll(userId, query)
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateLibraryTitle' })
  @Auth()
  @ApiOkResponse({ type: LibraryEntryResponse })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLibraryEntryDto
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.update(userId, id, dto)
  }

  /** Статус по ключу витрины: `tmdb-movie-603`. Нет записи — создаст */
  @Put('discover/:key')
  @ApiOperation({ operationId: 'setTitleStatus' })
  @Auth()
  @ApiOkResponse({ type: LibraryEntryResponse })
  setStatusByDiscoverKey(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
    @Body() dto: SetLibraryStatusDto
  ): Promise<LibraryEntryResponse> {
    return this.libraryService.setStatusByDiscoverKey(userId, key, dto)
  }

  @Delete('discover/:key')
  @ApiOperation({ operationId: 'removeFromLibrary' })
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteByDiscoverKey(
    @CurrentUser('id') userId: string,
    @Param('key') key: string
  ): Promise<boolean> {
    return this.libraryService.deleteByDiscoverKey(userId, key)
  }
}
