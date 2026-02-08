import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { nestConfigOptions } from "@slaops/config-nestjs";
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceModule } from './service/service.module';
import { OpenApiSearchModule } from './openapi-search/openapi-search.module';
import { config } from '@slaops/config';
import { SLAConfigModule } from './config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot(nestConfigOptions()),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // In Lambda, get credentials from Secrets Manager
        let username = config['db.username']
        let password = config['db.password']

        // If running in AWS Lambda with DB_SECRET_ARN
        const secretArn = configService.get('DB_SECRET_ARN');
        if (secretArn && !username) {
          // Credentials will be injected via environment variables by Lambda
          // or retrieved from Secrets Manager at runtime
          const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
          const client = new SecretsManagerClient({});
          const response = await client.send(
            new GetSecretValueCommand({ SecretId: secretArn })
          );

          if (response.SecretString) {
            const secret = JSON.parse(response.SecretString);
            username = secret.username;
            password = secret.password;
          }
        }

        return {
          type: 'postgres',
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT', 5432),
          username,
          password,
          database: configService.get('DB_NAME', 'slaops'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('NODE_ENV') !== 'production', // Disable in production
          ssl: configService.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
          logging: configService.get('DB_LOGGING') === 'true',
          // Lambda optimizations
          extra: {
            max: 1, // Single connection for Lambda
            connectionTimeoutMillis: 5000,
          },
        };
      },
    }),
    ServiceModule,
    OpenApiSearchModule,
    SLAConfigModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
