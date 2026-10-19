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
  Put,
  Query
} from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger'

import { Auth } from '../auth/decorators/auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { PaginationQueryDto } from '../base/pagination-query.dto'

import { CollectionService } from './collection.service'
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
  @ApiOperation({ operationId: 'myCollections' })
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
  @ApiOperation({ operationId: 'publicCollection' })
  @ApiOkResponse({ type: PublicCollectionResponse })
  findPublic(
    @Param('username') username: string,
    @Param('slug') slug: string
  ): Promise<PublicCollectionResponse> {
    return this.collectionService.findPublicBySlug(username, slug)
  }

  @Get(':id')
  @ApiOperation({ operationId: 'collectionById' })
  @Auth()
  @ApiOkResponse({ type: CollectionResponse })
  findById(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<CollectionResponse> {
    return this.collectionService.findById(userId, id)
  }

  @Post()
  @ApiOperation({ operationId: 'createCollection' })
  @Auth()
  @ApiCreatedResponse({ type: CollectionResponse })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCollectionDto
  ): Promise<CollectionResponse> {
    return this.collectionService.create(userId, dto)
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateCollection' })
  @Auth()
  @ApiOkResponse({ type: CollectionResponse })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto
  ): Promise<CollectionResponse> {
    return this.collectionService.update(userId, id, dto)
  }

  @Put(':id/titles/discover/:key')
  @ApiOperation({ operationId: 'addToCollection' })
  @Auth()
  @ApiOkResponse({ type: CollectionResponse })
  addTitleByDiscoverKey(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('key') key: string
  ): Promise<CollectionResponse> {
    return this.collectionService.addTitleByDiscoverKey(userId, id, key)
  }

  @Delete(':id/titles/discover/:key')
  @ApiOperation({ operationId: 'removeFromCollection' })
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeTitleByDiscoverKey(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('key') key: string
  ): Promise<void> {
    return this.collectionService.removeTitleByDiscoverKey(userId, id, key)
  }

  /** Поделиться подборкой — получатели увидят уведомление */
  @Post(':id/share')
  @ApiOperation({ operationId: 'shareCollection' })
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
  @ApiOperation({ operationId: 'deleteCollection' })
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ): Promise<boolean> {
    return this.collectionService.delete(userId, id)
  }
}
