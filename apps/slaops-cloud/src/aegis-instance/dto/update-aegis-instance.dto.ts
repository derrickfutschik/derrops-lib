import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator'

export class UpdateAegisInstanceDto {
  @ApiPropertyOptional({ description: 'Human-readable name for this Aegis instance', example: 'prod-aegis' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional({ description: 'Base URL of the Aegis instance (must be HTTPS)', example: 'https://aegis.example.com' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string

  @ApiPropertyOptional({ description: 'JWKS endpoint URL of the Aegis instance (must be HTTPS)', example: 'https://aegis.example.com/.well-known/jwks.json' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  jwksUrl?: string
}
