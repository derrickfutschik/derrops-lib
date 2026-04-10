import { useCallback, useRef, useState } from 'react'
import { API_BASE_URL } from '@/config'
import { cloudAxios } from '@/lib/cloud-api'

// ── Types ──────────────────────────────────────────────────────────────────

export interface RelayJobResult {
  statusCode: number
  statusText: string
  headers: Record<string, string>
  body: string
  timingMs: number
}

interface RelayJobError {
  code: string
  message: string
}

interface JobResponse {
  jobId: string
  status: 'pending' | 'claimed' | 'completed' | 'failed'
  connectionId: string
  createdAt: string
  completedAt: string | null
  result: RelayJobResult | null
  error: RelayJobError | null
}

export type RelayJobStatus = 'idle' | 'submitting' | 'waiting' | 'completed' | 'failed' | 'timed_out'

export interface RelayJobState {
  jobId: string | null
  status: RelayJobStatus
  result: RelayJobResult | null
  error: string | null
  connectionName: string | null
  deliveryMode: string | null
}

export interface RelayJobSubmitParams {
  connectionId: string
  connectionName: string
  deliveryMode: string
  request: {
    method: string
    url: string
    headers: Record<string, string>
    queryParams: Record<string, string>
    body: string | null
    contentType: string | null
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_TOTAL_WAIT_MS = 120_000
const WAIT_TIMEOUT_S = 25
const MAX_NETWORK_RETRIES = 3
const RETRY_DELAY_MS = 500

// ── Hook ───────────────────────────────────────────────────────────────────

export function useRelayJob() {
  const [state, setState] = useState<RelayJobState>({
    jobId: null,
    status: 'idle',
    result: null,
    error: null,
    connectionName: null,
    deliveryMode: null,
  })

  const abortRef = useRef<AbortController | null>(null)

  const submit = useCallback(async (params: RelayJobSubmitParams) => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setState({
      jobId: null,
      status: 'submitting',
      result: null,
      error: null,
      connectionName: params.connectionName,
      deliveryMode: params.deliveryMode,
    })

    try {
      // 1. Submit the job to slaops-cloud
      const { data: submitResp } = await cloudAxios.post<JobResponse>(
        `${API_BASE_URL}/cloud-relay/job`,
        { connectionId: params.connectionId, request: params.request },
        { signal: abort.signal },
      )

      // Direct mode: result returned synchronously
      if (submitResp.status === 'completed' && submitResp.result) {
        setState((s) => ({ ...s, jobId: submitResp.jobId, status: 'completed', result: submitResp.result }))
        return
      }

      if (submitResp.status === 'failed') {
        setState((s) => ({
          ...s,
          jobId: submitResp.jobId,
          status: 'failed',
          error: submitResp.error?.message ?? 'Job failed on submission',
        }))
        return
      }

      const { jobId } = submitResp
      setState((s) => ({ ...s, jobId, status: 'waiting' }))

      // 2. Long-poll loop
      let totalWaitedMs = 0
      let networkRetries = 0

      while (totalWaitedMs < MAX_TOTAL_WAIT_MS) {
        if (abort.signal.aborted) return

        const waitStart = Date.now()
        try {
          const { data: waitResp } = await cloudAxios.get<JobResponse>(
            `${API_BASE_URL}/cloud-relay/job/${jobId}/wait?timeout=${WAIT_TIMEOUT_S}`,
            { signal: abort.signal },
          )

          totalWaitedMs += Date.now() - waitStart
          networkRetries = 0

          if (waitResp.status === 'completed') {
            setState((s) => ({ ...s, status: 'completed', result: waitResp.result }))
            return
          }
          if (waitResp.status === 'failed') {
            setState((s) => ({
              ...s,
              status: 'failed',
              error: waitResp.error?.message ?? 'Relay execution failed',
            }))
            return
          }
          // status === 'pending' | 'claimed': re-issue immediately
        } catch (err: unknown) {
          if (abort.signal.aborted) return
          networkRetries++
          totalWaitedMs += Date.now() - waitStart
          if (networkRetries >= MAX_NETWORK_RETRIES) {
            setState((s) => ({
              ...s,
              status: 'failed',
              error: err instanceof Error ? err.message : 'Network error — could not reach platform',
            }))
            return
          }
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        }
      }

      // 120 s elapsed with no result
      setState((s) => ({
        ...s,
        status: 'timed_out',
        error: 'Relay did not respond within 120 s',
      }))
    } catch (err: unknown) {
      if (abort.signal.aborted) return
      setState((s) => ({
        ...s,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed to submit job to platform',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({
      jobId: null,
      status: 'idle',
      result: null,
      error: null,
      connectionName: null,
      deliveryMode: null,
    })
  }, [])

  return { ...state, submit, reset }
}
