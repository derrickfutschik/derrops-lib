import { Module } from '@nestjs/common'
import { OpenSearchModule } from '../opensearch/opensearch.module'
import { OpenApiIndexerService } from './openapi-indexer.service'
import { OpenApiParserService } from './openapi-parser.service'

@Module({
  imports: [OpenSearchModule],
  providers: [OpenApiIndexerService, OpenApiParserService],
  exports: [OpenApiIndexerService, OpenApiParserService],
})
export class OpenApiIndexerModule {}
