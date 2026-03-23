import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { configure as serverlessExpress } from '@codegenie/serverless-express'
import type { Handler } from 'aws-lambda'
import { AppModule } from './app.module'

let cachedHandler: Handler | undefined

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  )

  await app.init()

  const expressApp = app.getHttpAdapter().getInstance()
  return serverlessExpress({ app: expressApp })
}

export const handler: Handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  if (!cachedHandler) {
    cachedHandler = await bootstrap()
  }

  return cachedHandler(event, context, callback)
}
