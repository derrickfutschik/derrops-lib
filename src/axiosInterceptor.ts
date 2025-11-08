import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import type { HttpEvent, PrimitiveMap } from './types';
import { SlaOpsClient } from './SlaOpsClient';

export type InterceptorOptions = {
  endpoint: string;
  apiKey?: string;
  projectId?: string;
  sendPath?: string; // default /v1/events
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  redactHeaders?: (string | RegExp)[];
  buildTags?: (cfg: InternalAxiosRequestConfig, res?: AxiosResponse) => string[] | undefined;
  buildAttrs?: (cfg: InternalAxiosRequestConfig, res?: AxiosResponse) => PrimitiveMap | undefined;
};

const isInternal = (cfg: InternalAxiosRequestConfig) => cfg.headers?.['x-slaops-internal'] === '1';

const redact = (headers: any, patterns: (string | RegExp)[] | undefined) => {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const hit = (patterns ?? []).some((p) =>
      typeof p === 'string' ? k.toLowerCase() === p.toLowerCase() : (p as RegExp).test(k),
    );
    out[k] = hit ? '[REDACTED]' : String(v);
  }
  return out;
};

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
      const headers = redact(cfg.headers, options.redactHeaders);
      const url = new URL(cfg.url!, cfg.baseURL || 'http://localhost');

      const evt: HttpEvent = {
        request: {
          method: cfg.method?.toUpperCase() || 'GET',
          url: {
            href: url.toString(),
            origin: url.origin,
            host: url.host,
            pathname: url.pathname,
          },
          headers,
          body: options.includeRequestBody ? cfg.data : undefined,
        },
        response: {
          status: res.status,
          headers: redact(res.headers, options.redactHeaders),
          body: options.includeResponseBody ? res.data : undefined,
        },
        info: {
          bodySize: Number(res.headers?.['content-length'] ?? 0),
          truncation: 'NONE',
          bodyHash: '',
          pathHash: '',
          queryParamsHash: '',
          createdAt: startedAt,
          id: crypto.randomUUID(),
        },
        tags: options.buildTags?.(cfg, res),
        attributes: options.buildAttrs?.(cfg, res),
      };

      try {
        await client.sendEvent(evt, { path: options.sendPath });
      } catch {
        // swallow to avoid affecting app traffic
      }

      return res;
    },
    async (error) => {
      const cfg = error.config as InternalAxiosRequestConfig | undefined;
      if (!cfg || isInternal(cfg)) throw error;

      const startedAt = (cfg && (instance as any)._started?.get?.(cfg)) ?? Date.now();
      const headers = redact(cfg.headers, options.redactHeaders);
      const url = new URL(cfg.url!, cfg.baseURL || 'http://localhost');

      const status = error.response?.status ?? 0;

      const evt: HttpEvent = {
        request: {
          method: cfg.method?.toUpperCase() || 'GET',
          url: {
            href: url.toString(),
            origin: url.origin,
            host: url.host,
            pathname: url.pathname,
          },
          headers,
          body: options.includeRequestBody ? cfg.data : undefined,
        },
        response: {
          status,
          headers: error.response ? redact(error.response.headers, options.redactHeaders) : {},
          body: options.includeResponseBody ? error.response?.data : undefined,
        },
        info: {
          bodySize: Number(error.response?.headers?.['content-length'] ?? 0),
          truncation: 'NONE',
          bodyHash: '',
          pathHash: '',
          queryParamsHash: '',
          createdAt: startedAt,
          id: crypto.randomUUID(),
        },
        tags: options.buildTags?.(cfg, error.response),
        attributes: options.buildAttrs?.(cfg, error.response),
      };

      try {
        await client.sendEvent(evt, { path: options.sendPath });
      } catch {
        // swallow
      }

      throw error;
    },
  );
}
