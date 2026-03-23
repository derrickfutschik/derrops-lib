import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator'

export class CreateAegisInstanceDto {
  @ApiProperty({ description: 'Human-readable name for this Aegis instance', example: 'prod-aegis' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string

  @ApiProperty({ description: 'Base URL of the Aegis instance (must be HTTPS)', example: 'https://aegis.example.com' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string

  @ApiProperty({ description: 'JWKS endpoint URL of the Aegis instance (must be HTTPS)', example: 'https://aegis.example.com/.well-known/jwks.json' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  jwksUrl: string
}
