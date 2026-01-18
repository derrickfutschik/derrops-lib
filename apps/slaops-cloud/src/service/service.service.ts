import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
  ) {}

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    const service = this.serviceRepository.create(createServiceDto);
    return this.serviceRepository.save(service);
  }

  async findAll(select?: string[]): Promise<Service[]> {
    const queryBuilder = this.serviceRepository.createQueryBuilder('service');

    if (select && select.length > 0) {
      // Build select clause dynamically
      const selectFields = select.map((field) => `service.${field}`);
      queryBuilder.select(selectFields);
    }

    queryBuilder.orderBy('service.created_at', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, select?: string[]): Promise<Service> {
    const queryBuilder = this.serviceRepository.createQueryBuilder('service');

    if (select && select.length > 0) {
      const selectFields = select.map((field) => `service.${field}`);
      queryBuilder.select(selectFields);
    }

    queryBuilder.where('service.id = :id', { id });

    const service = await queryBuilder.getOne();

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return service;
  }

  async update(id: string, updateServiceDto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);

    Object.assign(service, updateServiceDto);

    return this.serviceRepository.save(service);
  }

  async remove(id: string): Promise<void> {
    const service = await this.findOne(id);
    await this.serviceRepository.remove(service);
  }
}
