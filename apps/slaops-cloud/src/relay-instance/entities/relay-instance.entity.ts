import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type RelayInstanceStatus = 'pending' | 'active' | 'unreachable' | 'disabled'

@Entity('relay_instance')
@Index('idx_ri_tenant', ['tenant_id'])
export class RelayInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 10 })
  tenant_id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text' })
  url: string

  @Column({ type: 'uuid', nullable: true })
  aegis_id: string | null

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RelayInstanceStatus

  @Column({ nullable: true })
  last_seen_at: Date | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
