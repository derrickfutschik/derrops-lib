import { Module } from '@nestjs/common';
import { OpenApiSearchController } from './openapi-search.controller';
import { OpenApiSearchService } from './openapi-search.service';

@Module({
  controllers: [OpenApiSearchController],
  providers: [OpenApiSearchService],
  exports: [OpenApiSearchService],
})
export class OpenApiSearchModule {}
