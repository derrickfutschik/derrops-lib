import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'

export class CreateApiDto {
  @ApiProperty({ example: 'Stripe Payments API' })
  @IsString()
  @MaxLength(255)
  name: string

  @ApiPropertyOptional({ example: 'Stripe REST API for payment processing' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({
    example: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalUrl?: string

  @ApiPropertyOptional({ enum: ['manual', 'url_fetch'], default: 'manual' })
  @IsOptional()
  @IsEnum(['manual', 'url_fetch'])
  versionStrategy?: 'manual' | 'url_fetch'

  @ApiPropertyOptional({
    example: '0 2 * * *',
    description: 'Cron schedule for url_fetch strategy (UTC). Uses platform default when omitted.',
  })
  @IsOptional()
  @IsString()
  fetchCron?: string

  @ApiPropertyOptional({
    example: 'https://example.com/openapi.yaml',
    description: 'URL to fetch the spec from (url_fetch strategy only)',
  })
  @IsOptional()
  @IsUrl()
  fetchUrl?: string
}
