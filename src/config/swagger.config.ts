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

  // operationId задан явно на каждом методе: orval делает из него имя хука,
  // и оно не должно меняться от переименования класса или метода
  return SwaggerModule.createDocument(app, config)
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app))
}
