import { ApiPropertyOptional } from '@nestjs/swagger'
import { Column } from 'typeorm'

export class VersionFetchState {
  @ApiPropertyOptional({
    enum: ['manual', 'url_fetch'],
    description:
      'manual    — spec is uploaded manually via the portal or pre-signed URL.\n' +
      'url_fetch — platform fetches the spec from fetch_url on a schedule.',
    default: 'manual',
  })
  @Column({
    name: 'fetch_strategy',
    type: 'varchar',
    length: 20,
    nullable: true,
    default: 'manual',
  })
  strategy: 'manual' | 'url_fetch' | null = 'manual'

  @ApiPropertyOptional({
    description:
      'URL the platform fetches the spec from (url_fetch strategy only). ' +
      'Must be publicly accessible or reachable from the SLAOps egress IP range.',
  })
  @Column({ name: 'fetch_url', type: 'text', nullable: true })
  url: string | null = null

  @ApiPropertyOptional({
    description:
      'Cron expression defining the fetch schedule (url_fetch strategy only). ' +
      'Defaults to config[oaspec.url-fetch.default-cron] when not specified.',
    example: '0 2 * * *',
  })
  @Column({ name: 'fetch_cron', type: 'varchar', length: 100, nullable: true })
  cron: string | null = null

  @ApiPropertyOptional({ description: 'Timestamp of the last fetch attempt' })
  @Column({ name: 'fetch_last_at', type: 'timestamp', nullable: true })
  lastAt: Date | null = null

  @ApiPropertyOptional({
    enum: ['ok', 'error', 'no_change'],
    description: 'Outcome of the last fetch attempt',
  })
  @Column({ name: 'fetch_last_status', type: 'varchar', length: 20, nullable: true })
  lastStatus: 'ok' | 'error' | 'no_change' | null = null

  @ApiPropertyOptional({ description: 'Error message from the last failed fetch attempt' })
  @Column({ name: 'fetch_last_error', type: 'text', nullable: true })
  lastError: string | null = null

  @ApiPropertyOptional({
    description:
      'Consecutive fetch failure count. When this reaches config[oaspec.url-fetch.backoff-threshold] the scheduler reduces to weekly cadence.',
  })
  @Column({ name: 'fetch_consecutive_failures', type: 'integer', nullable: true, default: 0 })
  consecutiveFailures: number | null = 0
}
