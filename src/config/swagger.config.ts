import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger'

/**
 * Схема нужна в двух местах: для Swagger UI на /api/docs
 * и для генерации openapi.json, из которого фронт получает типы и хуки.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('RED Marathōn API')
    .setDescription('One library for movies, TV shows, anime, books and games')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  // Без этого orval делает хуки вида useAuthControllerRegister.
  // Собираем короткое имя из домена и метода: useAuthRegister,
  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => {
      const domain = controllerKey.replace(/Controller$/, '')

      return `${domain.charAt(0).toLowerCase()}${domain.slice(1)}_${methodKey}`
    }
  })
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app))
}
