import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { redact } from '../../slaops-public/dist';
import type { HarEntry, HarLog, HarLogListener } from '../../slaops-public/dist';
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
  listeners?: HarLogListener[]
};

const isInternal = (cfg: InternalAxiosRequestConfig) => cfg.headers?.['x-slaops-internal'] === '1';

function headersToHar(headers: Record<string, any>): Array<{ name: string; value: string }> {
  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: String(value),
  }));
}

function extractQueryString(cfg: InternalAxiosRequestConfig, url: URL): Array<{ name: string; value: string }> {
  const entries: Array<{ name: string; value: string }> = [];
  const append = (name: string, value: unknown) => {
    if (value === undefined) return;
    entries.push({ name, value: String(value) });
  };

  url.searchParams.forEach((value, name) => {
    append(name, value);
  });

  if (entries.length) return entries;

  const serializeParams = (): string | undefined => {
    const serializer = (cfg as InternalAxiosRequestConfig & {
      paramsSerializer?: InternalAxiosRequestConfig['paramsSerializer'] & {
        serialize?: (params: unknown, options?: unknown) => string;
      };
    }).paramsSerializer;

    if (!serializer || cfg.params === undefined) return undefined;

    try {
      if (typeof serializer === 'function') {
        return serializer(cfg.params);
      }
      if (typeof serializer.serialize === 'function') {
        return serializer.serialize(cfg.params, serializer.encode);
      }
    } catch {
      // ignore serializer errors, fall back to best-effort parsing
    }

    return undefined;
  };

  const serialized = serializeParams();
  if (serialized) {
    new URLSearchParams(serialized).forEach((value, name) => {
      append(name, value);
    });
  }

  if (entries.length) return entries;

  const { params } = cfg;
  if (!params) return entries;

  if (params instanceof URLSearchParams) {
    params.forEach((value, name) => append(name, value));
    return entries;
  }

  if (typeof params === 'string') {
    new URLSearchParams(params).forEach((value, name) => append(name, value));
    return entries;
  }

  if (Array.isArray(params)) {
    for (const entry of params) {
      if (!entry) continue;
      if (Array.isArray(entry) && entry.length >= 2) {
        append(String(entry[0]), entry[1]);
      } else if (typeof entry === 'object' && 'name' in entry && 'value' in entry) {
        append(String(entry.name), (entry as { value: unknown }).value);
      }
    }
    return entries;
  }

  if (typeof params === 'object') {
    Object.entries(params as Record<string, unknown>).forEach(([name, value]) => {
      if (value === undefined) return;
      if (value === null) {
        append(name, '');
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((v) => append(name, v));
        return;
      }

      append(name, value);
    });
  }

  return entries;
}

export function attachSlaOpsInterceptor(instance: AxiosInstance, options: InterceptorOptions) {
  const client = new SlaOpsClient({
    endpoint: options.endpoint,
    apiKey: options.apiKey,
    projectId: options.projectId,
    listeners: options.listeners ?? [],
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
          queryString: extractQueryString(cfg, url),
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

      const harLog: HarLog = {
        version: '1.2',
        creator: {
          name: 'slaops-client-nodejs-axios',
          version: '1.0.0',
        },
        entries: [entry],
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
          queryString: extractQueryString(cfg, url),
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
