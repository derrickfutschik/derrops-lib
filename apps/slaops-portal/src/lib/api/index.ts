/**
 * SLAOps API Client
 *
 * Drop-in replacement for Supabase client with support for SLAOps Cloud backend
 */

export { api, slaopsClient } from './client';
export { servicesApi } from './services';
export type { Service, CreateServiceDto, UpdateServiceDto, ApiResponse, ApiError } from './types';
