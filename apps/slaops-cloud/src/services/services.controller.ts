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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created successfully', type: Service })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createServiceDto: CreateServiceDto): Promise<Service> {
    return this.servicesService.create(createServiceDto);
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
    return this.servicesService.findAll(selectFields);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service by ID' })
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
    return this.servicesService.findOne(id, selectFields);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service' })
  @ApiResponse({ status: 200, description: 'Service updated successfully', type: Service })
  @ApiResponse({ status: 404, description: 'Service not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service' })
  @ApiResponse({ status: 200, description: 'Service deleted successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.servicesService.remove(id);
    return { message: 'Service deleted successfully' };
  }
}
