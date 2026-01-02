import { ServicesApi, Configuration } from '@/client/slaops-cloud';
import type { Service, CreateServiceDto, UpdateServiceDto, ApiResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8083'; // TODO remove these and support a VPC mesh with local traefic setup for local development

/**
 * Services API Client
 *
 * Provides Supabase-compatible API methods for managing services
 * Now uses the generated TypeScript Axios client
 */
class ServicesApiWrapper {
  private client: ServicesApi;

  constructor(baseUrl: string = API_BASE_URL) {
    const config = new Configuration({
      basePath: baseUrl,
    });
    this.client = new ServicesApi(config);
  }

  /**
   * Fetch services with optional field selection
   * Compatible with Supabase's select() method
   */
  async select(fields?: string): Promise<ApiResponse<Service[]>> {
    try {
      const response = await this.client.servicesControllerFindAll();
      return { data: response.data as Service[], error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.response?.data?.message || error.message || 'Failed to fetch services',
          statusCode: error.response?.status,
          error: error.response?.data?.error,
        },
      };
    }
  }

  /**
   * Fetch a single service by ID
   */
  async findOne(id: string, fields?: string): Promise<ApiResponse<Service>> {
    try {
      const response = await this.client.servicesControllerFindOne(id);
      return { data: response.data as Service, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.response?.data?.message || error.message || 'Failed to fetch service',
          statusCode: error.response?.status,
          error: error.response?.data?.error,
        },
      };
    }
  }

  /**
   * Create a new service
   */
  async create(service: CreateServiceDto): Promise<ApiResponse<Service>> {
    try {
      const response = await this.client.servicesControllerCreate(service as any);
      return { data: response.data as Service, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.response?.data?.message || error.message || 'Failed to create service',
          statusCode: error.response?.status,
          error: error.response?.data?.error,
        },
      };
    }
  }

  /**
   * Update an existing service
   */
  async update(id: string, updates: UpdateServiceDto): Promise<ApiResponse<Service>> {
    try {
      const response = await this.client.servicesControllerUpdate(id, updates as any);
      return { data: response.data as Service, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.response?.data?.message || error.message || 'Failed to update service',
          statusCode: error.response?.status,
          error: error.response?.data?.error,
        },
      };
    }
  }

  /**
   * Delete a service
   */
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await this.client.servicesControllerRemove(id);
      return { data: response.data as any, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.response?.data?.message || error.message || 'Failed to delete service',
          statusCode: error.response?.status,
          error: error.response?.data?.error,
        },
      };
    }
  }
}

// Export a singleton instance
export const servicesApi = new ServicesApiWrapper();
