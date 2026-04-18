import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'

export class AdoptApiDto {
  @ApiProperty({
    description: 'OpenSearch document ID of the platform-managed spec in the global catalogue index',
    example: 'a1b2c3d4e5f67890a1b2c3d4e5f67890',
  })
  @IsString()
  @Length(1, 64)
  globalOpensearchId: string
}
