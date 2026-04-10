import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, IsUUID, IsUrl, MinLength } from 'class-validator'

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
    example: 'Production Relay',
    description: 'Human-readable name. Auto-generated if omitted.',
  })
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string

  @ApiPropertyOptional({
    example: 'https://xyz.execute-api.ap-southeast-2.amazonaws.com/prod',
    description:
      'Base URL of the relay instance. ' +
      'Required for direct and relay-queue modes, and for the HTTP path in hybrid mode. ' +
      'Not used for platform-queue connections (relay makes only outbound connections).',
  })
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  @IsOptional()
  url?: string

  @ApiPropertyOptional({
    enum: ['direct', 'relay-queue', 'platform-queue', 'hybrid'],
    default: 'direct',
    description:
      'direct          — slaops-cloud calls relay synchronously.\n' +
      'relay-queue     — slaops-cloud submits to relay queue, polls relay for result.\n' +
      'platform-queue  — relay polls slaops-cloud outbound. Use when relay cannot accept inbound connections.\n' +
      'hybrid          — platform tries direct HTTP first, falls back to SQS on failure. Requires both url and sqs_queue_url.\n' +
      'For local-dev relays this is always platform-queue regardless of what is sent.',
  })
  @IsIn(['direct', 'relay-queue', 'platform-queue', 'hybrid'])
  @IsOptional()
  delivery_mode?: 'direct' | 'relay-queue' | 'platform-queue' | 'hybrid'

  @ApiPropertyOptional({
    enum: ['platform', 'relay'],
    default: 'platform',
    description:
      'platform — SLAOps provisions and owns the SQS FIFO queue. ' +
      'relay    — Customer provisions the queue and grants sqs:SendMessage to the SLAOps platform role; provide relay_sqs_queue_url. ' +
      'Required when delivery_mode is platform-queue or hybrid.',
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
    description:
      'UUID of an AegisInstance to link to this connection. ' +
      'The Aegis must belong to the same tenant. ' +
      'Null or omitted means no Aegis is linked.',
    example: '9a1b2c3d-4e5f-6789-abcd-ef0123456789',
  })
  @IsUUID()
  @IsOptional()
  aegis_id?: string
}
