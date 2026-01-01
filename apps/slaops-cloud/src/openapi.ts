import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';

import { AppModule } from './app.module';

async function generateOpenApi() {

    console.log(`Creating Application`);

    const app = await NestFactory.create(AppModule, {
        logger: false
    });

    const config = new DocumentBuilder()
        .setTitle('SLAOps API')
        .setDescription('Internal API')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();

    console.log(`Generating OpenAPI Document`);

    const document = SwaggerModule.createDocument(app, config);

    const outputPath = join(process.cwd(), 'dist', 'openapi.json');
    writeFileSync(outputPath, JSON.stringify(document, null, 2));

    await app.close();

    console.log(`OpenAPI written to ${outputPath}`);
}

generateOpenApi();
