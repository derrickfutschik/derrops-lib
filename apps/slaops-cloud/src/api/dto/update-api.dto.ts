import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'

export class UpdateApiDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalUrl?: string

  @ApiPropertyOptional({ enum: ['manual', 'url_fetch'] })
  @IsOptional()
  @IsEnum(['manual', 'url_fetch'])
  versionStrategy?: 'manual' | 'url_fetch'

  @ApiPropertyOptional({ example: '0 2 * * *' })
  @IsOptional()
  @IsString()
  fetchCron?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  fetchUrl?: string
}
