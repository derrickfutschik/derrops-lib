import axios, { AxiosInstance } from 'axios';
import { BaseClient, type BaseClientOptions } from '@slaops/client';
import type { HarEntry } from '@slaops/lib';

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
        events: HarEntry[],
        init?: { path?: string; headers?: Record<string, string> },
    ) {
        const path = init?.path ?? '/v1/events';
        const url = this.endpoint + path;
        const headers = this.buildHeaders(init);

        events.forEach(event => console.log(JSON.stringify(event, null, 2)));

        // const res = await this.http.post(url, { entries: events }, { headers });
        // return { status: res.status, data: res.data };
        return { status: 200, data: undefined };
    }
}
