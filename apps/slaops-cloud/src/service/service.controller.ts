import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';

@ApiTags('Service')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created successfully', type: Service })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createServiceDto: CreateServiceDto): Promise<Service> {
    return this.serviceService.create(createServiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all services' })
  @ApiQuery({
    name: 'select',
    required: false,
    description: 'Comma-separated list of fields to select (e.g., id,name,endpoint)',
    example: 'id,name,endpoint,openapi_doc_url,openapi_doc_content',
  })
  @ApiResponse({ status: 200, description: 'List of services', type: [Service] })
  findAll(@Query('select') select?: string): Promise<Service[]> {
    const selectFields = select ? select.split(',').map((f) => f.trim()) : undefined;
    return this.serviceService.findAll(selectFields);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service by ID' })
  @ApiParam({
    name: 'id',
    description: 'Service UUID',
    example: '5c963787-d89d-4260-adaf-6541c41cb982',
  })
  @ApiQuery({
    name: 'select',
    required: false,
    description: 'Comma-separated list of fields to select',
  })
  @ApiResponse({ status: 200, description: 'Service found', type: Service })
  @ApiResponse({ status: 404, description: 'Service not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('select') select?: string,
  ): Promise<Service> {
    const selectFields = select ? select.split(',').map((f) => f.trim()) : undefined;
    return this.serviceService.findOne(id, selectFields);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service' })
  @ApiParam({
    name: 'id',
    description: 'Service UUID',
    example: '5c963787-d89d-4260-adaf-6541c41cb982',
  })
  @ApiResponse({ status: 200, description: 'Service updated successfully', type: Service })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    return this.serviceService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service' })
  @ApiParam({
    name: 'id',
    description: 'Service UUID',
    example: '5c963787-d89d-4260-adaf-6541c41cb982',
  })
  @ApiOkResponse({
    description: 'Service deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Service deleted successfully',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.serviceService.remove(id);
    return { message: 'Service deleted successfully' };
  }
}
