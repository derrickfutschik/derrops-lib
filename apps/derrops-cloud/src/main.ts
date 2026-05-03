import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { config } from '@derrops/config'
import { AppModule } from './app.module'
import { HttpLoggerMiddleware } from './common/http-logger.middleware'
import { VerboseExceptionFilter } from './common/verbose-exception.filter'
import { StrictStringPipe } from './validation/strict-string.pipe'
import { OpenSearchMigrateCommand } from './opensearch/opensearch.migrate.command'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Raise the JSON body limit to handle relay job results carrying full HTTP response bodies
  app.useBodyParser('json', { limit: config['app.body.json.limit'] })

  // Enable text body parsing for YAML/plain-text OpenAPI specs
  app.useBodyParser('text', {
    type: ['text/plain', 'text/yaml', 'application/x-yaml', 'application/yaml'],
  })

  if (process.argv.includes('opensearch:migrate')) {
    const cmd = app.get(OpenSearchMigrateCommand)
    await cmd.run()
    await app.close()
    return
  }

  // Enable CORS for any domain, including private network access (loopback)
  app.enableCors({ origin: '*' })
  app.use((_req: Request, res: any, next: () => void) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
    next()
  })

  // HTTP request/response logging middleware
  const httpLogger = new HttpLoggerMiddleware()
  app.use(httpLogger.use.bind(httpLogger))

  // Global exception filter — shows full stack traces when app.error.verbose is enabled
  app.useGlobalFilters(new VerboseExceptionFilter())

  // Global validation pipe — rejects strings with leading/trailing whitespace by default
  app.useGlobalPipes(
    new StrictStringPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  // TODO - require authentication from cognito ()

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

  console.log(`\n🚀 Derrops Cloud API is running on: http://localhost:${port}`)
  console.log(`📚 Swagger documentation: http://localhost:${port}/api\n`)
}

bootstrap()
