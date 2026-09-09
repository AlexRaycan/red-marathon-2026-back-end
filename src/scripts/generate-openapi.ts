import { NestFactory } from '@nestjs/core'
import { writeFileSync } from 'fs'
import { join } from 'path'

import { AppModule } from '../app.module'
import { buildOpenApiDocument } from '../config/swagger.config'

/**
 * Поднимает приложение, дампит схему в openapi.json и гасится.
 * Сервер при этом не слушает порт — нужна только структура маршрутов.
 */
async function generateOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false })
  const document = buildOpenApiDocument(app)

  writeFileSync(
    join(process.cwd(), 'openapi.json'),
    JSON.stringify(document, null, 2)
  )

  await app.close()

  console.log('openapi.json обновлён')
}

generateOpenApi()
