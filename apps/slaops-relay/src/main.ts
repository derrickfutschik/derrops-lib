import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { env } from './env'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  )

  app.enableCors()

  const doc = new DocumentBuilder()
    .setTitle('SLAOps Relay')
    .setDescription('Self-contained HTTP proxy relay service')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, doc))

  await app.listen(env.port)
}

bootstrap()
