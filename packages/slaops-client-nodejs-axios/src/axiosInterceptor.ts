import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { redact } from '@slaops/lib';
import type { HarEntry } from '@slaops/lib';
import { SlaOpsClient } from './SlaOpsClient';

export type InterceptorOptions = {
  endpoint: string;
  apiKey?: string;
  projectId?: string;
  sendPath?: string; // default /v1/events
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  redactHeaders?: (string | RegExp)[];
  buildExtensions?: (cfg: InternalAxiosRequestConfig, res?: AxiosResponse) => Record<`_${string}`, unknown> | undefined;
};

const isInternal = (cfg: InternalAxiosRequestConfig) => cfg.headers?.['x-slaops-internal'] === '1';

function headersToHar(headers: Record<string, any>): Array<{ name: string; value: string }> {
  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: String(value),
  }));
}

export function attachSlaOpsInterceptor(instance: AxiosInstance, options: InterceptorOptions) {
  const client = new SlaOpsClient({
    endpoint: options.endpoint,
    apiKey: options.apiKey,
    projectId: options.projectId,
  });

  const started = new WeakMap<InternalAxiosRequestConfig, number>();

  instance.interceptors.request.use(async (cfg) => {
    if (isInternal(cfg)) return cfg; // don't capture internal posts
    started.set(cfg, Date.now());
    return cfg;
  });

  instance.interceptors.response.use(
    async (res) => {
      const cfg = res.config;
      if (isInternal(cfg)) return res;

      const startedAt = started.get(cfg) ?? Date.now();
      const endedAt = Date.now();
      const headers = redact(cfg.headers, options.redactHeaders);
      const url = new URL(cfg.url!, cfg.baseURL || 'http://localhost');

      const requestBody = options.includeRequestBody && cfg.data
        ? (typeof cfg.data === 'string' ? cfg.data : JSON.stringify(cfg.data))
        : undefined;

      const responseBody = options.includeResponseBody && res.data
        ? (typeof res.data === 'string' ? res.data : JSON.stringify(res.data))
        : undefined;

      const entry: HarEntry = {
        startedDateTime: new Date(startedAt).toISOString(),
        time: endedAt - startedAt,
        request: {
          method: cfg.method?.toUpperCase() || 'GET',
          url: url.toString(),
          httpVersion: 'HTTP/1.1',
          cookies: [],
          headers: headersToHar(headers),
          queryString: Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value })),
          headersSize: -1,
          bodySize: requestBody ? Buffer.byteLength(requestBody, 'utf8') : 0,
          ...(requestBody && {
            postData: {
              mimeType: cfg.headers?.['content-type'] || 'application/json',
              text: requestBody,
            },
          }),
        },
        response: {
          status: res.status,
          statusText: res.statusText || '',
          httpVersion: 'HTTP/1.1',
          cookies: [],
          headers: headersToHar(redact(res.headers, options.redactHeaders)),
          content: {
            size: Number(res.headers?.['content-length'] ?? (responseBody ? Buffer.byteLength(responseBody, 'utf8') : 0)),
            mimeType: res.headers?.['content-type'] || 'application/json',
            ...(responseBody && { text: responseBody }),
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: Number(res.headers?.['content-length'] ?? (responseBody ? Buffer.byteLength(responseBody, 'utf8') : 0)),
        },
        cache: {},
        timings: {
          send: 0,
          wait: endedAt - startedAt,
          receive: 0,
        },
        ...(options.buildExtensions?.(cfg, res) ?? {}),
      };

      try {
        await client.sendEvent(entry, { path: options.sendPath });
      } catch {
        // swallow to avoid affecting app traffic
      }

      return res;
    },
    async (error) => {
      const cfg = error.config as InternalAxiosRequestConfig | undefined;
      if (!cfg || isInternal(cfg)) throw error;

      const startedAt = started.get(cfg) ?? Date.now();
      const endedAt = Date.now();
      const headers = redact(cfg.headers, options.redactHeaders);
      const url = new URL(cfg.url!, cfg.baseURL || 'http://localhost');

      const status = error.response?.status ?? 0;

      const requestBody = options.includeRequestBody && cfg.data
        ? (typeof cfg.data === 'string' ? cfg.data : JSON.stringify(cfg.data))
        : undefined;

      const responseBody = options.includeResponseBody && error.response?.data
        ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
        : undefined;

      const entry: HarEntry = {
        startedDateTime: new Date(startedAt).toISOString(),
        time: endedAt - startedAt,
        request: {
          method: cfg.method?.toUpperCase() || 'GET',
          url: url.toString(),
          httpVersion: 'HTTP/1.1',
          cookies: [],
          headers: headersToHar(headers),
          queryString: Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value })),
          headersSize: -1,
          bodySize: requestBody ? Buffer.byteLength(requestBody, 'utf8') : 0,
          ...(requestBody && {
            postData: {
              mimeType: cfg.headers?.['content-type'] || 'application/json',
              text: requestBody,
            },
          }),
        },
        response: {
          status,
          statusText: error.response?.statusText || 'Error',
          httpVersion: 'HTTP/1.1',
          cookies: [],
          headers: error.response ? headersToHar(redact(error.response.headers, options.redactHeaders)) : [],
          content: {
            size: Number(error.response?.headers?.['content-length'] ?? (responseBody ? Buffer.byteLength(responseBody, 'utf8') : 0)),
            mimeType: error.response?.headers?.['content-type'] || 'application/json',
            ...(responseBody && { text: responseBody }),
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: Number(error.response?.headers?.['content-length'] ?? (responseBody ? Buffer.byteLength(responseBody, 'utf8') : 0)),
        },
        cache: {},
        timings: {
          send: 0,
          wait: endedAt - startedAt,
          receive: 0,
        },
        ...(options.buildExtensions?.(cfg, error.response) ?? {}),
      };

      try {
        await client.sendEvent(entry, { path: options.sendPath });
      } catch {
        // swallow
      }

      throw error;
    },
  );
}
