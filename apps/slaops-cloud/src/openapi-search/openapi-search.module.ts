import { Module } from '@nestjs/common';
import { OpenSearchModule } from '../opensearch/opensearch.module';
import { OpenApiSearchController } from './openapi-search.controller';
import { OpenApiSearchService } from './openapi-search.service';

@Module({
  imports: [OpenSearchModule],
  controllers: [OpenApiSearchController],
  providers: [OpenApiSearchService],
  exports: [OpenApiSearchService],
})
export class OpenApiSearchModule { }
