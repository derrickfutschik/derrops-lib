import { ApiProperty } from '@nestjs/swagger'
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
  @Column({ type: 'uuid' })
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
    enum: ['direct', 'relay-queue', 'platform-queue'],
    description:
      'direct         — slaops-cloud calls relay synchronously. Relay must be reachable from slaops-cloud.\n' +
      'relay-queue    — slaops-cloud submits to relay queue, polls relay for result. Relay must be reachable from slaops-cloud.\n' +
      'platform-queue — relay polls slaops-cloud outbound and posts results back. Use when relay cannot accept inbound connections.',
  })
  @Column({ type: 'varchar', length: 20, default: 'direct' })
  delivery_mode: 'direct' | 'relay-queue' | 'platform-queue'

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
