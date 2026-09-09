import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import * as cookieParser from 'cookie-parser'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { setupSwagger } from './config/swagger.config'
import { CLIENT_URL, EXPO_URL, PORT } from './constants/app.constants'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.useGlobalFilters(new HttpExceptionFilter())

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cookieParser())
  app.disable('x-powered-by')

  app.enableCors({
    origin: [CLIENT_URL, EXPO_URL, /^chrome-extension:\/\//],
    credentials: true
  })

  setupSwagger(app)

  await app.listen(PORT)
}

bootstrap()
