import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, IsUrl, MinLength } from 'class-validator'

export class CreateCloudRelayConnectionDto {
  @ApiProperty({ example: 'us-east-1 relay' })
  @IsString()
  @MinLength(1)
  name: string

  @ApiProperty({ example: 'https://xyz.execute-api.ap-southeast-2.amazonaws.com/prod' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  url: string

  @ApiPropertyOptional({
    enum: ['direct', 'relay-queue', 'platform-queue'],
    default: 'direct',
    description:
      'direct          — slaops-cloud calls relay synchronously. Relay must be reachable from slaops-cloud.\n' +
      'relay-queue     — slaops-cloud submits to relay queue, polls relay for result. Relay must be reachable from slaops-cloud.\n' +
      'platform-queue  — relay polls slaops-cloud outbound and posts results back. Use when relay cannot accept inbound connections.',
  })
  @IsIn(['direct', 'relay-queue', 'platform-queue'])
  @IsOptional()
  delivery_mode?: 'direct' | 'relay-queue' | 'platform-queue'
}
