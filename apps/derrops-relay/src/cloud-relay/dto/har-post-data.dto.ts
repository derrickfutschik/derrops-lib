import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

export class HarPostDataParamDto {
  @ApiProperty()
  @IsString()
  declare name: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  value?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fileName?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contentType?: string
}

export class HarPostDataDto {
  @ApiProperty({ example: 'application/json' })
  @IsString()
  declare mimeType: string

  @ApiPropertyOptional({ description: 'Raw body text (JSON, XML, plain text)' })
  @IsString()
  @IsOptional()
  text?: string

  @ApiPropertyOptional({
    type: [HarPostDataParamDto],
    description: 'Form fields — mutually exclusive with text',
  })
  @ValidateNested({ each: true })
  @Type(() => HarPostDataParamDto)
  @IsOptional()
  params?: HarPostDataParamDto[]
}
