import type { HarEntry, HarLogListener } from '@derrops/public'

export type BaseClientOptions = {
  endpoint: string
  apiKey?: string
  projectId?: string
  timeoutMs?: number
  defaultHeaders?: Record<string, string>
  listeners: HarLogListener[]
}

export type SendResult = {
  status: number
  data: any
}

export abstract class BaseClient {
  protected readonly endpoint: string
  protected readonly apiKey?: string
  protected readonly projectId?: string
  protected readonly timeoutMs: number
  protected readonly defaultHeaders: Record<string, string>
  protected readonly listeners: HarLogListener[]

  constructor(opts: BaseClientOptions) {
    if (!opts?.endpoint) throw new Error('endpoint is required')
    this.endpoint = opts.endpoint.replace(/\/$/, '')
    this.apiKey = opts.apiKey
    this.projectId = opts.projectId
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.defaultHeaders = {
      'content-type': 'application/json',
      ...(opts.defaultHeaders ?? {}),
    }
    this.listeners = opts.listeners ?? []
  }

  async sendEvent(
    event: HarEntry,
    init?: { path?: string; headers?: Record<string, string> },
  ): Promise<SendResult> {
    return this.sendInternal([event], init)
  }

  async sendBatch(
    events: HarEntry[],
    init?: { path?: string; headers?: Record<string, string> },
  ): Promise<SendResult> {
    if (events.length === 0) return { status: 204, data: undefined }
    if (events.length > 500) throw new Error('Batch too large (max 500)')
    return this.sendInternal(events, init)
  }

  protected buildHeaders(init?: { headers?: Record<string, string> }): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      ...(this.projectId ? { 'x-derrops-project': this.projectId } : {}),
      ...(init?.headers ?? {}),
    }
  }

  protected async sendInternal(
    events: HarEntry[],
    init?: { path?: string; headers?: Record<string, string> },
  ): Promise<SendResult> {
    const response = await Promise.all(this.listeners.map((listener) => listener(events)))
    return response[0] ?? { status: 200, data: undefined }
  }
}
