import axios, { AxiosInstance } from 'axios'
import { BaseClient, type BaseClientOptions } from '@slaops/client'
import type { HarEntry } from '../../slaops-public/dist'

export type SlaOpsClientOptions = BaseClientOptions

export class SlaOpsClient extends BaseClient {
  private readonly http: AxiosInstance

  constructor(opts: SlaOpsClientOptions) {
    super(opts)

    // Separate internal axios to avoid recursive interception
    this.http = axios.create({
      timeout: this.timeoutMs,
      headers: { 'x-slaops-internal': '1' },
    })
  }
}
