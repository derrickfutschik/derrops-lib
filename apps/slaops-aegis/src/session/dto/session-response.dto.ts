import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PermittedEndpointDto {
  @ApiProperty() host: string
  @ApiProperty() method: string
  @ApiProperty() path: string
  @ApiPropertyOptional() operationId?: string
  @ApiProperty() relayId: string
  @ApiPropertyOptional() environment?: string
}

export class DeniedEndpointDto {
  @ApiProperty() host: string
  @ApiProperty() method: string
  @ApiProperty() path: string
  @ApiPropertyOptional() operationId?: string
  @ApiProperty() reason: string
}

export class SessionResponseDto {
  @ApiProperty({ description: 'Signed session delegation JWT to pass to the SLAOps platform' })
  sessionDelegationJWT: string

  @ApiProperty({ description: 'ISO timestamp when the JWT expires' })
  expiresAt: string

  @ApiProperty({
    type: [PermittedEndpointDto],
    description: 'Endpoints Cedar permitted for this session',
  })
  permittedEndpoints: PermittedEndpointDto[]

  @ApiProperty({
    type: [DeniedEndpointDto],
    description: 'Endpoints that were requested but denied by Cedar',
  })
  deniedEndpoints: DeniedEndpointDto[]
}
