import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Client } from '@opensearch-project/opensearch'
import * as dotenv from 'dotenv'
import { writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { TypescriptOSProxyClient } from 'opensearch-ts'

// Load environment variables from root .env file BEFORE importing app code
const envPath = resolve(__dirname, '../../../.env')
dotenv.config({ path: envPath })

async function generateOpenApi() {
  try {
    console.log(`Creating Application`)

    // Dynamically import app code AFTER env vars are loaded
    const { nestConfigOptions } = await import('@slaops/config-nestjs')
    const { ServiceController } = await import('./service/service.controller')
    const { ServiceService } = await import('./service/service.service')
    const { Service } = await import('./service/entities/service.entity')
    const { OpenApiIndexerController } = await import('./openapi-indexer/openapi-indexer.controller')
    const { OpenApiIndexerService } = await import('./openapi-indexer/openapi-indexer.service')
    const { OpenApiParserService } = await import('./openapi-indexer/openapi-parser.service')
    const { OpenAPICreateService } = await import('./openapi-indexer/openapi-create.service')
    const { OpenApiSearchController } = await import('./openapi-search/openapi-search.controller')
    const { OpenApiSearchService } = await import('./openapi-search/openapi-search.service')
    const { ConfigController } = await import('./config/config.controller')

    const mockValue = {} as any

    @Module({
      imports: [ConfigModule.forRoot(nestConfigOptions())],
      controllers: [
        ServiceController,
        OpenApiIndexerController,
        OpenApiSearchController,
        ConfigController,
      ],
      providers: [
        ServiceService,
        OpenApiIndexerService,
        OpenApiParserService,
        OpenAPICreateService,
        OpenApiSearchService,
        { provide: getRepositoryToken(Service), useValue: mockValue },
        { provide: Client, useValue: mockValue },
        { provide: TypescriptOSProxyClient, useValue: mockValue },
      ],
    })
    class AppOpenApiModule {}

    const app = await NestFactory.create(AppOpenApiModule, {
      logger: ['error', 'warn'],
    })

    const swaggerConfig = new DocumentBuilder()
      .setTitle('SLAOps API')
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
