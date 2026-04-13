import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator'
import { HarRequestDto } from './har-request.dto'

export class TemplateVariableDefinitionDto {
  @ApiProperty({ enum: ['secret', 'env', 'literal'] })
  @IsIn(['secret', 'env', 'literal'])
  declare type: 'secret' | 'env' | 'literal'

  @ApiPropertyOptional({
    description: 'Full secret URI for type: secret (e.g. aws-secretsmanager://arn:... or vault://host/path)',
  })
  @IsString()
  @IsOptional()
  secretUri?: string

  @ApiPropertyOptional({ description: 'JSON field selector for structured secrets (for type: secret)' })
  @IsString()
  @IsOptional()
  field?: string

  @ApiPropertyOptional({ description: 'Environment variable name (for type: env)' })
  @IsString()
  @IsOptional()
  envVar?: string

  @ApiPropertyOptional({ description: 'Static literal value (for type: literal)' })
  @IsString()
  @IsOptional()
  value?: string
}

export class TemplateContextDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: { $ref: '#/components/schemas/TemplateVariableDefinitionDto' } })
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDefinitionDto)
  @IsOptional()
  variables?: Record<string, TemplateVariableDefinitionDto>
}

export class CloudProxyRequestDto {
  @ApiProperty({ type: HarRequestDto })
  @ValidateNested()
  @Type(() => HarRequestDto)
  declare request: HarRequestDto

  @ApiPropertyOptional({ description: 'Request timeout in milliseconds (1000–60000)', example: 30000 })
  @IsInt()
  @Min(1000)
  @Max(60_000)
  @IsOptional()
  timeoutMs?: number

  @ApiPropertyOptional({ type: TemplateContextDto })
  @ValidateNested()
  @Type(() => TemplateContextDto)
  @IsOptional()
  templateContext?: TemplateContextDto
}
