import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('cloud_relay_connection')
@Index('idx_crc_tenant', ['tenant_id'])
export class CloudRelayConnection {
  @ApiProperty({ example: '5c963787-d89d-4260-adaf-6541c41cb982' })
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ApiProperty()
  @Column({ type: 'varchar', length: 10 })
  tenant_id: string

  @ApiProperty({ example: 'us-east-1 relay' })
  @Column({ type: 'varchar', length: 255 })
  name: string

  @ApiProperty({
    example: 'https://xyz.execute-api.ap-southeast-2.amazonaws.com/prod',
    description:
      'Base URL of the relay instance. ' +
      'Used for direct and relay-queue modes. ' +
      'For platform-queue mode, the relay is not called inbound — leave this as the relay identifier URL.',
  })
  @Column({ type: 'text' })
  url: string

  @ApiProperty({
    enum: ['managed', 'self-hosted', 'local-dev'],
    default: 'managed',
    description:
      'managed     — SLAOps-hosted Lambda relay.\n' +
      'self-hosted — Customer-deployed relay on their own infrastructure.\n' +
      'local-dev   — Developer local machine. delivery_mode is locked to platform-queue. An SQS FIFO queue is provisioned automatically.',
  })
  @Column({ type: 'varchar', length: 20, default: 'managed' })
  type: 'managed' | 'self-hosted' | 'local-dev'

  @ApiProperty({
    enum: ['direct', 'relay-queue', 'platform-queue', 'hybrid'],
    description:
      'direct         — slaops-cloud calls relay synchronously. Relay must be reachable from slaops-cloud.\n' +
      'relay-queue    — slaops-cloud submits to relay queue, polls relay for result. Relay must be reachable from slaops-cloud.\n' +
      'platform-queue — relay polls slaops-cloud outbound and posts results back. Use when relay cannot accept inbound connections.\n' +
      'hybrid         — platform tries direct HTTP first; falls back to platform-queue on failure. Requires both url and sqs_queue_url.',
  })
  @Column({ type: 'varchar', length: 20, default: 'direct' })
  delivery_mode: 'direct' | 'relay-queue' | 'platform-queue' | 'hybrid'

  @ApiPropertyOptional({
    enum: ['platform', 'relay'],
    description:
      'platform — SLAOps provisions and owns the SQS FIFO queue (default for local-dev). ' +
      'relay    — Customer provisions the queue in their own AWS account and grants the SlaOpsSqsPublishRole SendMessage access. ' +
      'Use relay mode when the customer\'s network cannot reach SQS endpoints in the SLAOps account.',
  })
  @Column({ type: 'varchar', length: 20, nullable: true })
  sqs_queue_mode: 'platform' | 'relay' | null

  @ApiPropertyOptional({
    description:
      'SQS FIFO queue URL for this relay connection. ' +
      'platform mode: provisioned by slaops-cloud and stored here. ' +
      'relay mode: provided by the customer at registration time.',
    example: 'https://sqs.ap-southeast-2.amazonaws.com/123456789/slaops-acme-local-abc123-relay456.fifo',
  })
  @Column({ type: 'text', nullable: true })
  sqs_queue_url: string | null

  @ApiPropertyOptional({
    description: 'AWS region of the SQS queue.',
    example: 'ap-southeast-2',
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  sqs_region: string | null

  @ApiPropertyOptional({
    description: 'UUID of the linked AegisInstance. Optional — null means no Aegis for this connection.',
    example: '9a1b2c3d-4e5f-6789-abcd-ef0123456789',
  })
  @Column({ type: 'uuid', nullable: true })
  aegis_id: string | null

  @ApiPropertyOptional({
    description:
      'ARN of the IAM user provisioned for relay SQS queue access (sqs_queue_mode=platform only). ' +
      'Null until IAM provisioning is implemented.',
  })
  @Column({ type: 'text', nullable: true })
  iam_user_arn: string | null

  @ApiPropertyOptional({
    description:
      'Access key ID of the IAM credential created for the relay. ' +
      'Stored for operator reference only — the secret access key is never stored.',
  })
  @Column({ type: 'text', nullable: true })
  iam_access_key_id: string | null

  @ApiProperty({
    description:
      'API key for relay authentication. ' +
      'direct/relay-queue: slaops-cloud sends this as Bearer token to the relay. ' +
      'platform-queue: relay sends this as Bearer token when polling slaops-cloud. ' +
      'Configure the relay with RELAY_API_KEY (inbound) or RELAY_PLATFORM_TOKEN (outbound polling).',
  })
  @Column({ type: 'uuid' })
  api_key: string

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  created_at: Date

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @UpdateDateColumn()
  updated_at: Date
}
