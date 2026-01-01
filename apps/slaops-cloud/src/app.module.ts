import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { nestConfigOptions } from "@slaops/slaops-config-nestjs";
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot(nestConfigOptions()),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production', // Disable in production
        ssl: configService.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        logging: configService.get('DB_LOGGING') === 'true',
      }),
    }),
    ServicesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
