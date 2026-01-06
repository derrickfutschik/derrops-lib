import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@codegenie/serverless-express';
import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AppModule } from './app.module';
import express = require('express');

let cachedServer: any;


/**
 * Bootstrap the NestJS application for AWS Lambda
 * Uses caching to reuse the server instance across invocations
 */
async function bootstrapServer(): Promise<any> {
  if (!cachedServer) {
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : ['log', 'error', 'warn', 'debug', 'verbose'],
      },
    );

    // Enable CORS for frontend integration
    nestApp.enableCors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    });

    // Global validation pipe
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Swagger documentation setup
    const config = new DocumentBuilder()
      .setTitle('SLAOps Cloud API')
      .setDescription('API for managing services and monitoring SLA compliance')
      .setVersion('1.0')
      .addTag('services')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(nestApp, config);
    SwaggerModule.setup('api', nestApp, document);

    await nestApp.init();

    cachedServer = serverlessExpress({ app: expressApp });
  }

  return cachedServer;
}

/**
 * AWS Lambda handler for the NestJS application
 * Handles API Gateway proxy events
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  // AWS Lambda best practice: reuse connections
  context.callbackWaitsForEmptyEventLoop = false;

  const server = await bootstrapServer();
  return server(event, context) as Promise<APIGatewayProxyResult>;
};
