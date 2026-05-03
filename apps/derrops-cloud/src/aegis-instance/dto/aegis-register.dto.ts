import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUrl, MinLength } from 'class-validator'

export class AegisRegisterDto {
  @ApiProperty({
    description: 'One-time registration token issued when the Aegis instance was created',
  })
  @IsString()
  @MinLength(1)
  registrationToken: string

  @ApiProperty({
    description: 'JWKS endpoint URL of the Aegis instance (must be HTTPS)',
    example: 'https://aegis.example.com/.well-known/jwks.json',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  jwksUrl: string
}
