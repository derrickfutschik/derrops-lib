import axios, { AxiosInstance } from 'axios';
import type { SlaOpsEvent } from './types';

export type SlaOpsClientOptions = {
  endpoint: string;
  apiKey?: string;
  projectId?: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
};

export class SlaOpsClient {
  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly projectId?: string;
  private readonly timeoutMs: number;
  private readonly http: AxiosInstance;
  private readonly defaultHeaders: Record<string, string>;

  constructor(opts: SlaOpsClientOptions) {
    if (!opts?.endpoint) throw new Error('endpoint is required');
    this.endpoint = opts.endpoint.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.projectId = opts.projectId;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.defaultHeaders = {
      'content-type': 'application/json',
      ...(opts.defaultHeaders ?? {}),
    };

    // Separate internal axios to avoid recursive interception
    this.http = axios.create({
      timeout: this.timeoutMs,
      headers: { 'x-slaops-internal': '1' },
    });
  }

  async sendEvent(event: SlaOpsEvent, init?: { path?: string; headers?: Record<string, string> }) {
    return this.sendInternal([event], init);
  }

  async sendBatch(
    events: SlaOpsEvent[],
    init?: { path?: string; headers?: Record<string, string> },
  ) {
    if (events.length === 0) return { status: 204, data: undefined };
    if (events.length > 500) throw new Error('Batch too large (max 500)');
    return this.sendInternal(events, init);
  }

  private async sendInternal(
    events: SlaOpsEvent[],
    init?: { path?: string; headers?: Record<string, string> },
  ) {
    const path = init?.path ?? '/v1/events';
    const url = this.endpoint + path;
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      ...(this.projectId ? { 'x-slaops-project': this.projectId } : {}),
      ...(init?.headers ?? {}),
    };
    const res = await this.http.post(url, { events }, { headers });
    return { status: res.status, data: res.data };
  }
}
