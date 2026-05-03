import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { OaSpecRef } from './oa-spec-ref'
import { VersionFetchState } from './version-fetch-state'

@Entity('api')
@Index('idx_api_tenant_name', ['tenantId', 'name'])
export class ApiEntity {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ApiProperty({ example: 't-bank0000' })
  @Column({ name: 'tenant_id', type: 'varchar', length: 10 })
  tenantId: string

  @ApiProperty({ example: 'Stripe Payments API' })
  @Column({ type: 'varchar', length: 255 })
  name: string

  @ApiPropertyOptional({ example: 'Stripe REST API for payment processing' })
  @Column({ type: 'text', nullable: true })
  description: string | null = null

  @ApiPropertyOptional({
    example: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
    description: 'External URL where the spec can be found or fetched from',
  })
  @Column({ name: 'external_url', type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null = null

  @ApiProperty({ example: 'openapi', description: 'Spec format type' })
  @Column({ name: 'spec_type', type: 'varchar', length: 50, default: 'openapi' })
  specType: string = 'openapi'

  @ApiProperty({
    enum: ['private', 'platform'],
    description:
      'private  — tenant owns and manages this spec.\n' +
      'platform — tenant has adopted a Derrops-managed spec from the global catalogue.',
    default: 'private',
  })
  @Column({ name: 'management_mode', type: 'varchar', length: 20, default: 'private' })
  managementMode: 'private' | 'platform' = 'private'

  /** OASpec storage + stats (null until first index run). */
  @Column(() => OaSpecRef)
  oaSpec: OaSpecRef

  /** Version fetch configuration (null columns when management_mode=platform or strategy=manual). */
  @Column(() => VersionFetchState)
  fetch: VersionFetchState

  @ApiProperty({ example: '2026-04-18T02:00:00.000Z' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @ApiProperty({ example: '2026-04-18T02:00:00.000Z' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
