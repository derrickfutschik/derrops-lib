import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator'

export class CreateRelayInstanceDto {
  @ApiProperty({ description: 'Human-readable name for this relay instance', example: 'prod-relay-eu' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string

  @ApiProperty({ description: 'Base URL of the relay (must be HTTPS)', example: 'https://relay.example.com' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string
}
