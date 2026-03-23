import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator'

export class UpdateRelayInstanceDto {
  @ApiPropertyOptional({ description: 'Human-readable name for this relay instance', example: 'prod-relay-eu' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional({ description: 'Base URL of the relay (must be HTTPS)', example: 'https://relay.example.com' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string

  @ApiPropertyOptional({ description: 'UUID of the linked Aegis instance (must belong to the same tenant)' })
  @IsOptional()
  @IsUUID()
  aegisId?: string
}
