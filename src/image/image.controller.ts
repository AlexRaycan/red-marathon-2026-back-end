import {
  BadGatewayException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'

import {
  IMAGE_CACHE_CONTROL,
  TMDB_IMAGE_FILE_PATTERN,
  TMDB_IMAGE_URL
} from '../constants/integration.constants'

@ApiExcludeController()
@Controller('images')
export class ImageController {
  @Get('tmdb/:file')
  @Header('Cache-Control', IMAGE_CACHE_CONTROL)
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async tmdb(@Param('file') file: string): Promise<StreamableFile> {
    if (!TMDB_IMAGE_FILE_PATTERN.test(file)) throw new NotFoundException()

    const response = await fetch(`${TMDB_IMAGE_URL}/${file}`).catch(() => null)

    if (!response) throw new BadGatewayException()
    if (!response.ok) throw new NotFoundException()

    return new StreamableFile(Buffer.from(await response.arrayBuffer()), {
      type: response.headers.get('content-type') ?? 'image/jpeg'
    })
  }
}
