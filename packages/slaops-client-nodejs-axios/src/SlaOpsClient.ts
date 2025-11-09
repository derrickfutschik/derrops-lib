import axios, { AxiosInstance } from 'axios';
import { BaseClient, type BaseClientOptions, type SlaOpsEvent } from '@slaops/client';

export type SlaOpsClientOptions = BaseClientOptions;

export class SlaOpsClient extends BaseClient {
  private readonly http: AxiosInstance;

  constructor(opts: SlaOpsClientOptions) {
    super(opts);

    // Separate internal axios to avoid recursive interception
    this.http = axios.create({
      timeout: this.timeoutMs,
      headers: { 'x-slaops-internal': '1' },
    });
  }

  protected async sendInternal(
    events: SlaOpsEvent[],
    init?: { path?: string; headers?: Record<string, string> },
  ) {
    const path = init?.path ?? '/v1/events';
    const url = this.endpoint + path;
    const headers = this.buildHeaders(init);
    const res = await this.http.post(url, { events }, { headers });
    return { status: res.status, data: res.data };
  }
}
