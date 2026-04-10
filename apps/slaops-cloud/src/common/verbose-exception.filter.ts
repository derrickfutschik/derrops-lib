import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { config } from '@slaops/config'
import { Request, Response } from 'express'

@Catch()
export class VerboseExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const isHttpException = exception instanceof HttpException

    if (config['app.error.verbose']) {
      const stack = exception instanceof Error ? exception.stack : undefined
      const message = exception instanceof Error ? exception.message : String(exception)
      const detail = isHttpException ? exception.getResponse() : undefined

      response.status(status).json({
        statusCode: status,
        message,
        ...(detail && typeof detail === 'object' ? { detail } : {}),
        ...(stack ? { stack } : {}),
        path: request.url,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Default NestJS behaviour for HTTP exceptions; re-throw for unknown errors so
      // NestJS's built-in handler produces the standard {"statusCode":500,"message":"Internal server error"}
      if (isHttpException) {
        const body = exception.getResponse()
        response.status(status).json(body)
      } else {
        response.status(status).json({
          statusCode: status,
          message: 'Internal server error',
        })
      }
    }
  }
}
