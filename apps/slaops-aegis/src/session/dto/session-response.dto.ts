import { ApiProperty } from '@nestjs/swagger'

export class DelegationScopeDto {
  @ApiProperty() apiId: string
  @ApiProperty({ required: false }) environment?: string
  @ApiProperty({ type: [String] }) allowedMethods: string[]
  @ApiProperty({ type: [String] }) pathPatterns: string[]
  @ApiProperty({ type: [String] }) relayIds: string[]
  @ApiProperty({ required: false }) maxBodyBytes?: number
}

export class SessionResponseDto {
  @ApiProperty({ description: 'Signed session delegation JWT to pass to the SLAOps platform' })
  sessionDelegationJWT: string

  @ApiProperty({ description: 'ISO timestamp when the JWT expires' })
  expiresAt: string

  @ApiProperty({ type: [DelegationScopeDto], description: 'Scopes granted to the user' })
  grantedScopes: DelegationScopeDto[]

  @ApiProperty({ type: [Object], description: 'Scopes that were requested but denied' })
  deniedScopes: { relayId: string; reason: string }[]
}
