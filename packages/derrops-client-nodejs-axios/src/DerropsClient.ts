import { BaseClient, type BaseClientOptions } from '@derrops/client'
import axios, { AxiosInstance } from 'axios'

export type DerropsClientOptions = BaseClientOptions

export class DerropsClient extends BaseClient {
  private readonly http: AxiosInstance

  constructor(opts: DerropsClientOptions) {
    super(opts)

    // Separate internal axios to avoid recursive interception
    this.http = axios.create({
      timeout: this.timeoutMs,
      headers: { 'x-derrops-internal': '1' },
    })
  }
}
