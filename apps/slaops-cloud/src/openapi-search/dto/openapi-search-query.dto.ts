import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsArray, IsInt, Min, Max, IsIn } from 'class-validator'
import { Transform, Type } from 'class-transformer'

/**
 * DTO for OpenAPI search query parameters
 */
export class OpenApiSearchQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search across title, description, and operation text',
    example: 'user authentication',
  })
  @IsOptional()
  @IsString()
  query?: string

  @ApiPropertyOptional({
    description: 'Filter by provider/domain',
    example: 'github.com',
  })
  @IsOptional()
  @IsString()
  provider?: string

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated)',
    example: 'payments,billing',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((t) => t.trim()) : value,
  )
  tags?: string[]

  @ApiPropertyOptional({
    description: 'Filter by HTTP method',
    example: 'POST',
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
  method?: string

  @ApiPropertyOptional({
    description: 'Filter by path prefix (from operationStats.pathPrefixes)',
    example: '/users',
  })
  @IsOptional()
  @IsString()
  pathPrefix?: string

  @ApiPropertyOptional({
    description: 'Filter by exact operationId',
    example: 'getUser',
  })
  @IsOptional()
  @IsString()
  operationId?: string

  @ApiPropertyOptional({
    description: 'Filter by server URL pattern',
    example: 'api.github.com',
  })
  @IsOptional()
  @IsString()
  serverPattern?: string

  @ApiPropertyOptional({
    description: 'Pagination offset',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  from?: number = 0

  @ApiPropertyOptional({
    description: 'Number of results to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['title', 'provider', 'indexedAt', 'operationStats.total', '_score'],
    default: '_score',
  })
  @IsOptional()
  @IsString()
  @IsIn(['title', 'provider', 'indexedAt', 'operationStats.total', '_score'])
  sortField?: string = '_score'

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}
