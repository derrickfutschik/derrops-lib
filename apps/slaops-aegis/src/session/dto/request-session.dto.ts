import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator'

export class RequestedScopeDto {
  @ApiProperty({ description: 'API identifier the user wants access to', example: 'partner-payments' })
  @IsString()
  apiId: string

  @ApiPropertyOptional({ description: 'Deployment environment', example: 'uat' })
  @IsOptional()
  @IsString()
  environment?: string

  @ApiProperty({ description: 'Relay UUID the request will be executed through' })
  @IsUUID()
  relayId: string
}

export class RequestSessionDto {
  @ApiProperty({ description: 'Customer tenant identifier', example: 'westpac-uat' })
  @IsString()
  tenantId: string

  @ApiProperty({
    description:
      'JWT issued by the customer SSO IdP that proves user identity. ' +
      'Validated against CUSTOMER_IDP_JWKS_URL.',
  })
  @IsString()
  userToken: string

  @ApiProperty({ type: [RequestedScopeDto], description: 'API scopes the user is requesting access to' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestedScopeDto)
  requestedScopes: RequestedScopeDto[]
}
