import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator'
import { HarNameValueDto } from './har-name-value.dto'
import { HarPostDataDto } from './har-post-data.dto'

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

export class HarRequestDto {
  @ApiProperty({ enum: ALLOWED_METHODS })
  @IsIn(ALLOWED_METHODS)
  declare method: string

  @ApiProperty({ example: 'https://api.example.com/v1/users' })
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  declare url: string

  @ApiProperty({ example: 'HTTP/1.1' })
  @IsString()
  declare httpVersion: string

  @ApiProperty({ type: [HarNameValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HarNameValueDto)
  declare headers: HarNameValueDto[]

  @ApiProperty({ type: [HarNameValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HarNameValueDto)
  declare queryString: HarNameValueDto[]

  @ApiProperty({ type: [HarNameValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HarNameValueDto)
  declare cookies: HarNameValueDto[]

  @ApiPropertyOptional({ type: HarPostDataDto })
  @ValidateNested()
  @Type(() => HarPostDataDto)
  @IsOptional()
  postData?: HarPostDataDto

  @ApiProperty({ description: 'Headers size in bytes (-1 if unknown)', example: -1 })
  @IsInt()
  declare headersSize: number

  @ApiProperty({ description: 'Body size in bytes (-1 if unknown or no body)', example: -1 })
  @IsInt()
  declare bodySize: number
}
