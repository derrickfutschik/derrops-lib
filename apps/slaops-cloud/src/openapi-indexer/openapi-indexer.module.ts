import { Module } from '@nestjs/common'
import { OpenApiIndexerService } from './openapi-indexer.service'
import { OpenApiParserService } from './openapi-parser.service'

@Module({
  providers: [OpenApiIndexerService, OpenApiParserService],
  exports: [OpenApiIndexerService, OpenApiParserService],
})
export class OpenApiIndexerModule {}
