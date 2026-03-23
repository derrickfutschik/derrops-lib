import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export type AegisInstanceStatus = 'pending' | 'active' | 'unreachable' | 'disabled'

@Entity('aegis_instance')
@Index('idx_ai_tenant', ['tenant_id'])
export class AegisInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  tenant_id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text' })
  url: string

  @Column({ type: 'text' })
  jwks_url: string

  @Column({ type: 'text', nullable: true })
  registration_token_hash: string | null

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: AegisInstanceStatus

  @Column({ nullable: true })
  last_seen_at: Date | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
