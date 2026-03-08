import { Module } from '@nestjs/common'
import { OpenSearchModule } from '../opensearch/opensearch.module'
import { OpenApiIndexerController } from './openapi-indexer.controller'
import { OpenApiIndexerService } from './openapi-indexer.service'
import { OpenApiParserService } from './openapi-parser.service'
import { OpenAPICreateService } from './openapi-create.service'

@Module({
  imports: [OpenSearchModule],
  controllers: [OpenApiIndexerController],
  providers: [OpenApiIndexerService, OpenApiParserService, OpenAPICreateService],
  exports: [OpenApiIndexerService, OpenApiParserService],
})
export class OpenApiIndexerModule {}
