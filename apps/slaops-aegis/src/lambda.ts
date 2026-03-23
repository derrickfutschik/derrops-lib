import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { Handler } from 'aws-lambda'
import { AppModule } from './app.module'

let handler: Handler

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  )

  await app.init()

  const { configure } = await import('@codegenie/serverless-express')
  const expressApp = app.getHttpAdapter().getInstance()
  return configure({ app: expressApp })
}

export const lambdaHandler: Handler = async (event, context, callback) => {
  if (!handler) {
    handler = await bootstrap()
  }
  return handler(event, context, callback)
}
