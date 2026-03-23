import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsUUID, ValidateNested } from 'class-validator'

/**
 * Mirrors CloudProxyRequestDto from apps/slaops-relay.
 * Stored as JSONB and forwarded to the relay without re-validation here.
 */
export class CloudRelayJobRequestDto {
  [key: string]: unknown
}

export class CreateCloudRelayJobDto {
  @ApiProperty({ description: 'ID of the relay connection that should execute this job' })
  @IsUUID()
  connectionId: string

  @ApiProperty({ description: 'Full CloudProxyRequestDto payload (HAR request + optional templateContext)' })
  @ValidateNested()
  @Type(() => CloudRelayJobRequestDto)
  request: CloudRelayJobRequestDto
}
