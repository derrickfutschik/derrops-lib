import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OpenApiInfoResultDto {
  @ApiProperty({ description: 'OpenAPI info.title' })
  title: string

  @ApiPropertyOptional({ description: 'OpenAPI info.description' })
  description?: string

  @ApiPropertyOptional({ description: 'OpenAPI info.version' })
  version?: string

  @ApiProperty({ description: 'Raw YAML/JSON spec content fetched from the URL' })
  rawContent: string
}
