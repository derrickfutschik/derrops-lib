import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class MaskingInfoDto {
  @ApiProperty({ type: [String] })
  declare maskedSecretIds: string[]

  @ApiProperty()
  declare bodyMasked: boolean

  @ApiProperty()
  declare headersMasked: boolean
}

export class CloudProxyResponseDto {
  @ApiProperty({ example: 200 })
  declare status: number

  @ApiProperty({ example: 'OK' })
  declare statusText: string

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  declare headers: Record<string, string>

  @ApiProperty({ example: '{"users":[]}' })
  declare body: string

  @ApiProperty({ description: 'Duration from relay perspective in milliseconds', example: 142 })
  declare durationMs: number

  @ApiProperty({ example: '2026-03-22T10:00:00.000Z' })
  declare requestedAt: string

  @ApiPropertyOptional({ type: MaskingInfoDto })
  masking?: MaskingInfoDto
}

export class CloudProxyErrorDto {
  @ApiProperty()
  declare error: string

  @ApiProperty({
    enum: ['TIMEOUT', 'NETWORK_ERROR', 'INVALID_URL', 'UNSUPPORTED_METHOD', 'POLICY_DENIED', 'TEMPLATE_ERROR'],
  })
  declare code: 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_URL' | 'UNSUPPORTED_METHOD' | 'POLICY_DENIED' | 'TEMPLATE_ERROR'

  @ApiProperty()
  declare durationMs: number
}
