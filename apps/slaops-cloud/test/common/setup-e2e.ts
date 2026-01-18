import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '@slaops/slaops-cloud/app.module';
import { AppConfig, makeConfig } from '@slaops/slaops-config';

export const setupE2EApp = async (): Promise<INestApplication> => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Swagger documentation setup
    const config: AppConfig = makeConfig(process.env);
    const docConfig = new DocumentBuilder()
        .setTitle(config["app.title"])
        .setDescription(config["app.description"])
        .setVersion(config["app.version"])
        .addTag('service')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup('api', app, document);

    await app.init();

    return app;
};

