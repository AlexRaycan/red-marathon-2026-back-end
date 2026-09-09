import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common'
import { Request, Response } from 'express'

import { ErrorResponse } from '../response/error-response'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const isHttpException = exception instanceof HttpException

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    // Неожиданные ошибки логируем, наружу отдаём безопасное сообщение
    if (!isHttpException) {
      this.logger.error(
        `Unexpected error on ${request.method} ${request.url}`,
        exception
      )
    }

    const body: ErrorResponse = {
      statusCode,
      message: isHttpException
        ? this._extractMessage(exception)
        : 'Internal server error',
      error: isHttpException ? exception.name : 'InternalServerError',
      path: request.url,
      timestamp: new Date().toISOString()
    }

    response.status(statusCode).json(body)
  }

  // ValidationPipe кладёт массив сообщений в объект — достаём его как есть
  private _extractMessage(exception: HttpException): string | string[] {
    const payload = exception.getResponse()

    if (typeof payload === 'string') return payload

    const { message } = payload as { message?: string | string[] }

    return message ?? exception.message
  }
}
