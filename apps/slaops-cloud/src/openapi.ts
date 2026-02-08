import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { writeFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from root .env file BEFORE importing AppModule
const envPath = resolve(__dirname, '../../../.env')
dotenv.config({ path: envPath })

async function generateOpenApi() {
  try {
    console.log(`Creating Application`)

    // Dynamically import AppModule AFTER env vars are loaded
    const { AppModule } = await import('./app.module')

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
    })

    const config = new DocumentBuilder()
      .setTitle('SLAOps API')
      .setDescription('Internal API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build()

    console.log(`Generating OpenAPI Document`)

    const document = SwaggerModule.createDocument(app, config)

    const outputFiles = [
      join(process.cwd(), 'dist', 'openapi.json'),
      join(process.cwd(), 'src', 'openapi.json'),
    ]

    outputFiles.forEach((outputPath) => {
      writeFileSync(outputPath, JSON.stringify(document, null, 2))
      console.log(`OpenAPI written to ${outputPath}`)
    })

    await app.close()

    // kill docker container
  } catch (error) {
    console.error('Failed to generate OpenAPI specification:')
    console.error(error)
    process.exit(1)
  }
}

generateOpenApi()
