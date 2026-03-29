import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, IsUrl, MinLength } from 'class-validator'

export class CreateCloudRelayConnectionDto {
  @ApiPropertyOptional({
    enum: ['managed', 'self-hosted', 'local-dev'],
    default: 'managed',
    description:
      'managed     — SLAOps-hosted Lambda relay.\n' +
      'self-hosted — Customer-deployed relay on their own infrastructure.\n' +
      'local-dev   — Developer local machine. delivery_mode is locked to platform-queue and an SQS FIFO queue is provisioned automatically.',
  })
  @IsIn(['managed', 'self-hosted', 'local-dev'])
  @IsOptional()
  type?: 'managed' | 'self-hosted' | 'local-dev'

  @ApiPropertyOptional({
    example: 'us-east-1 relay',
    description: 'Human-readable name. Auto-generated for local-dev relays.',
  })
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string

  @ApiPropertyOptional({
    example: 'https://xyz.execute-api.ap-southeast-2.amazonaws.com/prod',
    description:
      'Base URL of the relay instance. ' +
      'Required for direct and relay-queue modes. ' +
      'Not used for platform-queue / local-dev relays (relay makes only outbound connections).',
  })
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  @IsOptional()
  url?: string

  @ApiPropertyOptional({
    enum: ['platform', 'relay'],
    default: 'platform',
    description:
      'platform — SLAOps provisions the SQS FIFO queue (default). ' +
      'relay    — Customer provisions the queue; provide relay_sqs_queue_url. ' +
      'Only relevant for local-dev relay connections.',
  })
  @IsIn(['platform', 'relay'])
  @IsOptional()
  sqs_queue_mode?: 'platform' | 'relay'

  @ApiPropertyOptional({
    description:
      'Customer-owned SQS FIFO queue URL. Required when sqs_queue_mode=relay. ' +
      'The customer must grant the SlaOpsSqsPublishRole sqs:SendMessage permission on this queue.',
    example: 'https://sqs.ap-southeast-2.amazonaws.com/999888777/my-relay-queue.fifo',
  })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @IsOptional()
  relay_sqs_queue_url?: string

  @ApiPropertyOptional({
    enum: ['direct', 'relay-queue', 'platform-queue'],
    default: 'direct',
    description:
      'direct          — slaops-cloud calls relay synchronously. Relay must be reachable from slaops-cloud.\n' +
      'relay-queue     — slaops-cloud submits to relay queue, polls relay for result. Relay must be reachable from slaops-cloud.\n' +
      'platform-queue  — relay polls slaops-cloud outbound and posts results back. Use when relay cannot accept inbound connections.\n' +
      'For local-dev relays this is always platform-queue regardless of what is sent.',
  })
  @IsIn(['direct', 'relay-queue', 'platform-queue'])
  @IsOptional()
  delivery_mode?: 'direct' | 'relay-queue' | 'platform-queue'
}
