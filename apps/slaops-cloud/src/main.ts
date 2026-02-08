import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { config } from '@slaops/config'
import { OpenSearchMigrateCommand } from './opensearch/opensearch.migrate.command'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  if (process.argv.includes('opensearch:migrate')) {
    const cmd = app.get(OpenSearchMigrateCommand)
    await cmd.run()
    await app.close()
    return
  }

  // Enable CORS for frontend integration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  // Swagger documentation setup
  const docConfig = new DocumentBuilder()
    .setTitle(config['app.title'])
    .setDescription(config['app.description'])
    .setVersion(config['app.version'])
    .addTag('service')
    .addTag('config')
    .addTag('Config')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, docConfig)
  SwaggerModule.setup('api', app, document)

  const port = config['app.port']
  await app.listen(port)

  console.log(`\n🚀 SLAOps Cloud API is running on: http://localhost:${port}`)
  console.log(`📚 Swagger documentation: http://localhost:${port}/api\n`)
}

bootstrap()
