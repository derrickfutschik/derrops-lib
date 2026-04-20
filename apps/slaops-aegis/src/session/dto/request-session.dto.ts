import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

export class RequestedEndpointDto {
  @ApiProperty({ description: 'API hostname', example: 'payments.internal' })
  @IsString()
  host: string

  @ApiProperty({ description: 'HTTP method', example: 'GET', enum: HTTP_METHODS })
  @IsIn(HTTP_METHODS)
  method: string

  @ApiProperty({ description: 'URL path pattern', example: '/v1/orders/{id}' })
  @IsString()
  path: string

  @ApiPropertyOptional({
    description: 'OpenAPI operationId — used as the Cedar ApiEndpoint entity ID',
    example: 'getOrder',
  })
  @IsOptional()
  @IsString()
  operationId?: string

  @ApiProperty({ description: 'Relay UUID the request will be executed through' })
  @IsUUID()
  relayId: string

  @ApiPropertyOptional({ description: 'Deployment environment', example: 'prod' })
  @IsOptional()
  @IsString()
  environment?: string

  @ApiPropertyOptional({
    description: 'OpenAPI tags for this operation — used in tag-based Cedar policies',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}

export class RequestSessionDto {
  @ApiProperty({ description: 'Customer tenant identifier', example: 'acme-corp' })
  @IsString()
  tenantId: string

  @ApiProperty({
    description:
      'Cognito access token that proves user identity. ' +
      'Validated against CUSTOMER_IDP_JWKS_URL (the Cognito JWKS endpoint). ' +
      'Claims are mapped to Cedar principal attributes and context.',
  })
  @IsString()
  userToken: string

  @ApiProperty({
    type: [RequestedEndpointDto],
    description: 'API endpoints the user is requesting access to',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestedEndpointDto)
  requestedEndpoints: RequestedEndpointDto[]

  @ApiPropertyOptional({
    description: 'Originating IP address — used in IP-based Cedar policies',
    example: '10.0.0.5',
  })
  @IsOptional()
  @IsString()
  ipAddress?: string
}
