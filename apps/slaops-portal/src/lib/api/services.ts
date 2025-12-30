import type { Service, CreateServiceDto, UpdateServiceDto, ApiResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Services API Client
 *
 * Provides Supabase-compatible API methods for managing services
 */
class ServicesApi {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch services with optional field selection
   * Compatible with Supabase's select() method
   */
  async select(fields?: string): Promise<ApiResponse<Service[]>> {
    try {
      const url = new URL(`${this.baseUrl}/services`);
      if (fields) {
        url.searchParams.set('select', fields);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status}`,
        }));
        return {
          data: null,
          error: {
            message: error.message || 'Failed to fetch services',
            statusCode: response.status,
            error: error.error,
          },
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.message || 'Network error',
        },
      };
    }
  }

  /**
   * Fetch a single service by ID
   */
  async findOne(id: string, fields?: string): Promise<ApiResponse<Service>> {
    try {
      const url = new URL(`${this.baseUrl}/services/${id}`);
      if (fields) {
        url.searchParams.set('select', fields);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status}`,
        }));
        return {
          data: null,
          error: {
            message: error.message || 'Failed to fetch service',
            statusCode: response.status,
            error: error.error,
          },
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.message || 'Network error',
        },
      };
    }
  }

  /**
   * Create a new service
   */
  async create(service: CreateServiceDto): Promise<ApiResponse<Service>> {
    try {
      const response = await fetch(`${this.baseUrl}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(service),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status}`,
        }));
        return {
          data: null,
          error: {
            message: error.message || 'Failed to create service',
            statusCode: response.status,
            error: error.error,
          },
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.message || 'Network error',
        },
      };
    }
  }

  /**
   * Update an existing service
   */
  async update(id: string, updates: UpdateServiceDto): Promise<ApiResponse<Service>> {
    try {
      const response = await fetch(`${this.baseUrl}/services/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status}`,
        }));
        return {
          data: null,
          error: {
            message: error.message || 'Failed to update service',
            statusCode: response.status,
            error: error.error,
          },
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.message || 'Network error',
        },
      };
    }
  }

  /**
   * Delete a service
   */
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/services/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status}`,
        }));
        return {
          data: null,
          error: {
            message: error.message || 'Failed to delete service',
            statusCode: response.status,
            error: error.error,
          },
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error.message || 'Network error',
        },
      };
    }
  }
}

// Export a singleton instance
export const servicesApi = new ServicesApi();
