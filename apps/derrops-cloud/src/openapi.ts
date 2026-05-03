// Stub required env vars so the config schema passes during OpenAPI generation.
// No real connections are made — all providers are mocked.
process.env.NODE_ENV ??= 'dev'
process.env.DB_HOST ??= 'localhost'
process.env.DB_USERNAME ??= 'postgres'
process.env.DB_PASSWORD ??= 'postgres'
process.env.AWS_REGION ??= 'ap-southeast-2'
process.env.AWS_ACCOUNT_ID ??= '000000000000'
process.env.OPENSEARCH_ENDPOINT ??= 'http://localhost:9200'
process.env.DYNAMODB_ENDPOINT ??= 'http://localhost:4566'
process.env.VITE_APP_AUTH_MOCK_ENABLED ??= 'true'

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Client } from '@opensearch-project/opensearch'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { TypescriptOSProxyClient } from 'opensearch-ts'

async function generateOpenApi() {
  try {
    console.log(`Creating Application`)

    // Dynamically import app code AFTER env vars are loaded
    const { nestConfigOptions } = await import('@derrops/config-nestjs')
    const { ServiceController } = await import('./service/service.controller')
    const { ServiceService } = await import('./service/service.service')
    const { Service } = await import('./service/entities/service.entity')
    const { OpenApiIndexerController } = await import(
      './openapi-indexer/openapi-indexer.controller'
    )
    const { OpenApiIndexerService } = await import('./openapi-indexer/openapi-indexer.service')
    const { OpenApiParserService } = await import('./openapi-indexer/openapi-parser.service')
    const { OpenApiSearchController } = await import('./openapi-search/openapi-search.controller')
    const { OpenApiSearchService } = await import('./openapi-search/openapi-search.service')
    const { ConfigController } = await import('./config/config.controller')
    const { RelayInstanceController } = await import('./relay-instance/relay-instance.controller')
    const { RelayInstanceService } = await import('./relay-instance/relay-instance.service')
    const { RelayInstance } = await import('./relay-instance/entities/relay-instance.entity')
    const { AegisInstanceController } = await import('./aegis-instance/aegis-instance.controller')
    const { AegisRegisterController } = await import('./aegis-instance/aegis-register.controller')
    const { AegisInstanceService } = await import('./aegis-instance/aegis-instance.service')
    const { AegisInstance } = await import('./aegis-instance/entities/aegis-instance.entity')
    const { CloudRelayController } = await import('./cloud-relay/cloud-relay.controller')
    const { CloudRelayService } = await import('./cloud-relay/cloud-relay.service')
    const { RelayQueueService } = await import('./cloud-relay/relay-queue.service')
    const { CloudRelayConnection } = await import(
      './cloud-relay/entities/cloud-relay-connection.entity'
    )
    const { CloudRelayJob } = await import('./cloud-relay/entities/cloud-relay-job.entity')
    const { VendorJwtService } = await import('./vendor-jwt/vendor-jwt.service')
    const { ApiService } = await import('./api/api.service')
    const { ApiEntity } = await import('./api/entities/api.entity')
    const { ApiController } = await import('./api/api.controller')
    const { OpenSearchService } = await import('./opensearch/opensearch.service')

    const mockValue = {} as any

    @Module({
      imports: [ConfigModule.forRoot(nestConfigOptions())],
      controllers: [
        ServiceController,
        ApiController,
        OpenApiIndexerController,
        OpenApiSearchController,
        ConfigController,
        RelayInstanceController,
        AegisInstanceController,
        AegisRegisterController,
        CloudRelayController,
      ],
      providers: [
        ServiceService,
        ApiService,
        OpenSearchService,
        OpenApiIndexerService,
        OpenApiParserService,
        OpenApiSearchService,
        RelayInstanceService,
        AegisInstanceService,
        CloudRelayService,
        RelayQueueService,
        VendorJwtService,
        { provide: getRepositoryToken(Service), useValue: mockValue },
        { provide: getRepositoryToken(ApiEntity), useValue: mockValue },
        { provide: getRepositoryToken(RelayInstance), useValue: mockValue },
        { provide: getRepositoryToken(AegisInstance), useValue: mockValue },
        { provide: getRepositoryToken(CloudRelayConnection), useValue: mockValue },
        { provide: getRepositoryToken(CloudRelayJob), useValue: mockValue },
        { provide: Client, useValue: mockValue },
        { provide: TypescriptOSProxyClient, useValue: mockValue },
      ],
    })
    class AppOpenApiModule {}

    const app = await NestFactory.create(AppOpenApiModule, {
      logger: ['error', 'warn'],
    })

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Derrops API')
      .setDescription('Internal API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build()

    console.log(`Generating OpenAPI Document`)

    const document = SwaggerModule.createDocument(app, swaggerConfig)

    const outputFiles = [
      join(process.cwd(), 'dist', 'openapi.json'),
      join(process.cwd(), 'src', 'openapi.json'),
    ]

    outputFiles.forEach((outputPath) => {
      writeFileSync(outputPath, JSON.stringify(document, null, 2))
      console.log(`OpenAPI written to ${outputPath}`)
    })

    await app.close()
  } catch (error) {
    console.error('Failed to generate OpenAPI specification:')
    console.error(error)
    process.exit(1)
  }
}

generateOpenApi()
