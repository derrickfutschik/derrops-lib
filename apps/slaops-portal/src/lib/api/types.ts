/**
 * API Client Types
 */

export interface Service {
  id: string;
  user_id: string;
  name: string;
  endpoint: string;
  openapi_doc_url?: string | null;
  openapi_doc_content?: string | null;
  availability?: number | null;
  response_time?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateServiceDto {
  user_id: string;
  name: string;
  endpoint: string;
  openapi_doc_url?: string | null;
  openapi_doc_content?: string | null;
  availability?: number | null;
  response_time?: number | null;
}

export interface UpdateServiceDto {
  user_id?: string;
  name?: string;
  endpoint?: string;
  openapi_doc_url?: string | null;
  openapi_doc_content?: string | null;
  availability?: number | null;
  response_time?: number | null;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}
