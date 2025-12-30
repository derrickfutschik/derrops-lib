import { servicesApi } from './services';
import type { Service, ApiResponse } from './types';

/**
 * SLAOps API Client
 *
 * Provides a Supabase-compatible interface for the SLAOps Cloud API
 */
class SlaOpsApiClient {
  /**
   * Access services table
   * Mimics Supabase's from() method for easy migration
   */
  from(table: 'services') {
    if (table === 'services') {
      return {
        /**
         * Select services with optional fields
         * @example
         * api.from('services').select('id, name, endpoint')
         * api.from('services').select() // all fields
         */
        select: (fields?: string) => {
          return {
            /**
             * Order results
             * @example .order('created_at', { ascending: false })
             */
            order: (field: string, options?: { ascending?: boolean }) => {
              // Note: The backend currently orders by created_at DESC by default
              // This is a compatibility layer - ordering is handled server-side
              return servicesApi.select(fields);
            },
            then: (
              resolve: (value: ApiResponse<Service[]>) => void,
              reject?: (reason: any) => void,
            ) => {
              return servicesApi.select(fields).then(resolve, reject);
            },
            catch: (reject: (reason: any) => void) => {
              return servicesApi.select(fields).catch(reject);
            },
          };
        },
        /**
         * Insert a new service
         * @example api.from('services').insert({ name: 'API', endpoint: 'https://...' })
         */
        insert: (data: any) => {
          return servicesApi.create(data);
        },
        /**
         * Update a service by ID
         * @example api.from('services').update({ name: 'New Name' }).eq('id', '...')
         */
        update: (updates: any) => {
          return {
            eq: (field: string, value: string) => {
              if (field === 'id') {
                return servicesApi.update(value, updates);
              }
              throw new Error(`Filtering by ${field} is not yet supported`);
            },
          };
        },
        /**
         * Delete a service
         * @example api.from('services').delete().eq('id', '...')
         */
        delete: () => {
          return {
            eq: (field: string, value: string) => {
              if (field === 'id') {
                return servicesApi.delete(value);
              }
              throw new Error(`Filtering by ${field} is not yet supported`);
            },
          };
        },
      };
    }

    throw new Error(`Table ${table} is not supported`);
  }
}

// Export a singleton instance
export const api = new SlaOpsApiClient();

// For backward compatibility with Supabase client imports
export { api as slaopsClient };
