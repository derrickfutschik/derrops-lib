import { ApiProperty } from '@nestjs/swagger'
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('service')
export class Service {
  @ApiProperty({
    description: 'Primary key in database',
    example: '5c963787-d89d-4260-adaf-6541c41cb982',
    required: true,
  })
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ApiProperty({
    description: 'User ID who owns this service',
    example: '5c963787-d89d-4260-adaf-6541c41cb982',
  })
  @Column({ type: 'uuid' })
  user_id: string

  @ApiProperty({
    description: 'Service name',
    example: 'SendGrid API',
  })
  @Column({ type: 'varchar', length: 255 })
  name: string

  @ApiProperty({
    description: 'Service endpoint URL',
    example: 'https://api.sendgrid.com/v3',
  })
  @Column({ type: 'varchar', length: 500 })
  endpoint: string

  @ApiProperty({
    description: 'OpenAPI document URL',
    example: 'https://raw.githubusercontent.com/sendgrid/sendgrid-oai/main/oai.json',
    required: false,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  openapi_doc_url: string | null

  @ApiProperty({
    description: 'OpenAPI document content (stored as text)',
    required: false,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  openapi_doc_content: string | null

  @ApiProperty({
    description: 'Service availability percentage',
    example: 99.98,
    required: false,
    nullable: true,
    minimum: 0,
    maximum: 100,
  })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: null })
  availability: number | null

  @ApiProperty({
    description: 'Average response time in milliseconds',
    example: 80,
    required: false,
    nullable: true,
    minimum: 0,
  })
  @Column({ type: 'integer', nullable: true, default: null })
  response_time: number | null

  @ApiProperty({
    description: 'Date when the service was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  @CreateDateColumn()
  created_at: Date

  @ApiProperty({
    description: 'Date when the service was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  @UpdateDateColumn()
  updated_at: Date
}
