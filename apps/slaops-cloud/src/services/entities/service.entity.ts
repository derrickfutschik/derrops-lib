import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  openapi_doc_url: string | null;

  @Column({ type: 'text', nullable: true })
  openapi_doc_content: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: null })
  availability: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  response_time: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
