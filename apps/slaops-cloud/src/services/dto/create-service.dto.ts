import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsNumber, IsUrl, Min, Max } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({
    description: 'User ID who owns this service',
    example: '5c963787-d89d-4260-adaf-6541c41cb982',
  })
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: 'Service name',
    example: 'SendGrid API',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Service endpoint URL',
    example: 'https://api.sendgrid.com/v3',
  })
  @IsUrl()
  endpoint: string;

  @ApiProperty({
    description: 'OpenAPI document URL',
    example: 'https://raw.githubusercontent.com/sendgrid/sendgrid-oai/main/oai.json',
    required: false,
  })
  @IsOptional()
  @IsString()
  openapi_doc_url?: string | null;

  @ApiProperty({
    description: 'OpenAPI document content (stored as text)',
    required: false,
  })
  @IsOptional()
  @IsString()
  openapi_doc_content?: string | null;

  @ApiProperty({
    description: 'Service availability percentage',
    example: 99.98,
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  availability?: number | null;

  @ApiProperty({
    description: 'Average response time in milliseconds',
    example: 80,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  response_time?: number | null;
}
