import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID, IsUrl, MinLength } from 'class-validator'

export class UpdateCloudRelayConnectionDto {
  @ApiPropertyOptional({
    example: 'Production Relay',
    description: 'New human-readable name for the connection.',
  })
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string

  @ApiPropertyOptional({
    example: 'https://relay.example.com',
    description:
      'Updated base URL of the relay. Not applicable for platform-queue connections (no inbound URL).',
  })
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  @IsOptional()
  url?: string

  @ApiPropertyOptional({
    description:
      'UUID of an AegisInstance to link. Must belong to the same tenant. ' +
      'Pass null to unlink the current Aegis.',
    example: '9a1b2c3d-4e5f-6789-abcd-ef0123456789',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  aegis_id?: string | null
}
