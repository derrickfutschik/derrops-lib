import { BackoffStrategy, RetryPolicy } from './types'

/**
 * Computes the delay in milliseconds before the next attempt.
 *
 * @param backoff          - The configured backoff strategy.
 * @param failedAttemptIdx - 0-based index of the attempt that just failed
 *                           (0 = first failure → delay before attempt 2).
 */
export function computeDelay(backoff: BackoffStrategy, failedAttemptIdx: number): number {
  switch (backoff.type) {
    case 'none':
      return 0
    case 'fixed':
      return backoff.delay
    case 'exponential': {
      const multiplier = backoff.multiplier ?? 2
      return Math.round(backoff.initialDelay * Math.pow(multiplier, failedAttemptIdx))
    }
    case 'steps': {
      const idx = Math.min(failedAttemptIdx, backoff.delays.length - 1)
      return backoff.delays[idx]!
    }
  }
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function validateRetryPolicy(stepName: string, policy: RetryPolicy): void {
  const prefix = `Step "${stepName}" retry`

  if (policy.maxAttempts < 1) throw new Error(`${prefix}.maxAttempts must be >= 1`)

  if (policy.maxDelay !== undefined && policy.maxDelay <= 0)
    throw new Error(`${prefix}.maxDelay must be > 0`)

  if (policy.maxTotalDelay !== undefined && policy.maxTotalDelay <= 0)
    throw new Error(`${prefix}.maxTotalDelay must be > 0`)

  if (policy.maxRestarts !== undefined && policy.maxRestarts < 0)
    throw new Error(`${prefix}.maxRestarts must be >= 0`)

  if (policy.backoff) {
    const b = policy.backoff
    if (b.type === 'fixed' && b.delay < 0) throw new Error(`${prefix}.backoff.delay must be >= 0`)
    if (b.type === 'exponential' && b.initialDelay < 0)
      throw new Error(`${prefix}.backoff.initialDelay must be >= 0`)
    if (b.type === 'exponential' && b.multiplier !== undefined && b.multiplier <= 0)
      throw new Error(`${prefix}.backoff.multiplier must be > 0`)
    if (b.type === 'steps') {
      if (b.delays.length === 0)
        throw new Error(`${prefix}.backoff.delays must not be empty when type is "steps"`)
      if (b.delays.some((d) => d < 0))
        throw new Error(`${prefix}.backoff.delays entries must all be >= 0`)
    }
  }
}
