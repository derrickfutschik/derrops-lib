import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

export type CloudRelayJobStatus = 'pending' | 'claimed' | 'completed' | 'failed'

@Entity('cloud_relay_job')
@Index('idx_crj_connection_status', ['connection_id', 'status'])
@Index('idx_crj_tenant', ['tenant_id'])
export class CloudRelayJob {
  @ApiProperty({ example: '5c963787-d89d-4260-adaf-6541c41cb982' })
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ApiProperty()
  @Column({ type: 'uuid' })
  connection_id: string

  @ApiProperty()
  @Column({ type: 'varchar', length: 10 })
  tenant_id: string

  @ApiProperty()
  @Column({ type: 'uuid' })
  user_id: string

  @ApiProperty({ enum: ['direct', 'relay-queue', 'platform-queue'] })
  @Column({ type: 'varchar', length: 20 })
  delivery_mode: 'direct' | 'relay-queue' | 'platform-queue'

  @ApiProperty({ enum: ['pending', 'claimed', 'completed', 'failed'] })
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: CloudRelayJobStatus

  @ApiPropertyOptional({
    description:
      'Full CloudProxyRequestDto payload. ' +
      'Stored for platform-queue (relay reads it when claiming) and direct mode. ' +
      'Null for relay-queue (relay owns the request data).',
  })
  @Column({ type: 'jsonb', nullable: true })
  request: object | null

  @ApiPropertyOptional({
    description: 'Relay-internal job ID. Set for relay-queue mode only.',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  relay_job_id: string | null

  @ApiPropertyOptional({
    description: 'CloudProxyResponseDto or CloudProxyErrorDto. Set once job completes.',
  })
  @Column({ type: 'jsonb', nullable: true })
  result: object | null

  @ApiPropertyOptional()
  @Column({ nullable: true })
  claimed_at: Date | null

  @ApiPropertyOptional()
  @Column({ nullable: true })
  completed_at: Date | null

  @ApiProperty()
  @CreateDateColumn()
  created_at: Date

  @ApiProperty()
  @Column({ type: 'timestamptz' })
  expires_at: Date
}
