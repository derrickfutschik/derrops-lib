import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class HarNameValueDto {
  @ApiProperty()
  @IsString()
  declare name: string

  @ApiProperty()
  @IsString()
  declare value: string
}
