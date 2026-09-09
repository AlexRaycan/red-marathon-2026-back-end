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
import { PaginationQueryDto } from '../base/pagination-query.dto'

import { CollectionService } from './collection.service'
import { CollectionTitlesDto } from './dto/collection-titles.dto'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { ShareCollectionDto } from './dto/share-collection.dto'
import { UpdateCollectionDto } from './dto/update-collection.dto'
import {
  CollectionListResponse,
  CollectionResponse,
  PublicCollectionResponse
} from './response/collection-response'

@ApiTags('collections')
@Controller('collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  @Auth()
  @ApiOkResponse({ type: CollectionListResponse })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto
  ): Promise<CollectionListResponse> {
    return this.collectionService.findAll(userId, query)
  }

  /** Публичная подборка по ссылке — без авторизации */
  @Get('public/:username/:slug')
  @ApiOkResponse({ type: PublicCollectionResponse })
  findPublic(
    @Param('username') username: string,
    @Param('slug') slug: string
  ): Promise<PublicCollectionResponse> {
    return this.collectionService.findPublicBySlug(username, slug)
  }

  @Get(':id')
  @Auth()
  @ApiOkResponse({ type: CollectionResponse })
  findById(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<CollectionResponse> {
    return this.collectionService.findById(userId, id)
  }

  @Post()
  @Auth()
  @ApiOkResponse({ type: CollectionResponse })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCollectionDto
  ): Promise<CollectionResponse> {
    return this.collectionService.create(userId, dto)
  }

  @Patch(':id')
  @Auth()
  @ApiOkResponse({ type: CollectionResponse })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto
  ): Promise<CollectionResponse> {
    return this.collectionService.update(userId, id, dto)
  }

  @Post(':id/titles')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CollectionResponse })
  addTitles(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CollectionTitlesDto
  ): Promise<CollectionResponse> {
    return this.collectionService.addTitles(userId, id, dto)
  }

  @Delete(':id/titles')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CollectionResponse })
  removeTitles(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CollectionTitlesDto
  ): Promise<CollectionResponse> {
    return this.collectionService.removeTitles(userId, id, dto)
  }

  /** Поделиться подборкой — получатели увидят уведомление */
  @Post(':id/share')
  @Auth()
  @HttpCode(HttpStatus.OK)
  share(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ShareCollectionDto
  ): Promise<boolean> {
    return this.collectionService.share(userId, id, dto)
  }

  @Delete(':id')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.collectionService.delete(userId, id)
  }
}
