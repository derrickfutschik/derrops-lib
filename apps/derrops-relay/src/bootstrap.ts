import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { env } from './env'

/**
 * Creates and configures the NestJS application instance.
 * Exported for programmatic use (e.g. derrops-cli `relay start` command).
 * Called by main.ts for the standalone server and lambda.ts for AWS Lambda.
 */
export async function bootstrapRelay(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  )

  app.enableCors()

  const doc = new DocumentBuilder()
    .setTitle('Derrops Relay')
    .setDescription('Self-contained HTTP proxy relay service')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, doc))

  await app.listen(env.port)
}
