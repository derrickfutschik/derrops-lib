import { describe, it, expect, jest } from '@jest/globals'
import { createPipeline, AnalyticsCollector } from '../index'

type Input = { id: string }

function makeAnalytics(): jest.Mocked<AnalyticsCollector> {
  return {
    onStepStart: jest.fn(),
    onStepAttempt: jest.fn(),
    onStepComplete: jest.fn(),
    onStepSkipped: jest.fn(),
    onPipelineRestart: jest.fn(),
    onPipelineComplete: jest.fn(),
    onPipelineError: jest.fn(),
  }
}

// ---------------------------------------------------------------------------
// maxAttempts
// ---------------------------------------------------------------------------

describe('retry.maxAttempts', () => {
  it('maxAttempts: 1 means no retry — one attempt total', async () => {
    let calls = 0
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('always fails')
        },
        retry: { maxAttempts: 1 },
      })
      .execute({ id: 'x' })

    expect(calls).toBe(1)
    expect(result.success).toBe(false)
  })

  it('maxAttempts: 3 makes up to 3 execute calls', async () => {
    let calls = 0
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('fail')
        },
        retry: { maxAttempts: 3 },
      })
      .execute({ id: 'x' })

    expect(calls).toBe(3)
  })

  it('succeeds on the second attempt', async () => {
    let calls = 0
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          if (calls < 2) throw new Error('transient')
          return { done: true }
        },
        retry: { maxAttempts: 3 },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
    expect(calls).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// AttemptRecord in StepRecord
// ---------------------------------------------------------------------------

describe('StepRecord.attempts', () => {
  it('records one attempt for a step that succeeds immediately', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }) })
      .execute({ id: 'x' })

    expect(result.steps[0].attempts).toHaveLength(1)
    expect(result.steps[0].attempts[0].attempt).toBe(1)
    expect(result.steps[0].attempts[0].error).toBeUndefined()
    expect(result.steps[0].attempts[0].timedOut).toBe(false)
  })

  it('records one attempt per execute call when retrying', async () => {
    let calls = 0
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          if (calls < 3) throw new Error(`fail ${calls}`)
          return { done: true }
        },
        retry: { maxAttempts: 4 },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
    expect(result.steps[0].attempts).toHaveLength(3) // 2 failures + 1 success
    expect(result.steps[0].attempts[0].attempt).toBe(1)
    expect(result.steps[0].attempts[0].error?.message).toBe('fail 1')
    expect(result.steps[0].attempts[1].attempt).toBe(2)
    expect(result.steps[0].attempts[1].error?.message).toBe('fail 2')
    expect(result.steps[0].attempts[2].attempt).toBe(3)
    expect(result.steps[0].attempts[2].error).toBeUndefined()
  })

  it('records all attempts when all fail', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('always')
        },
        retry: { maxAttempts: 3 },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    expect(result.steps[0].attempts).toHaveLength(3)
    expect(result.steps[0].attempts.every((a) => a.error !== undefined)).toBe(true)
  })

  it('records empty attempts for a skipped step', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.steps[0].skipped).toBe(true)
    expect(result.steps[0].attempts).toHaveLength(0)
  })

  it('each attempt has timing fields', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ v: 1 }) })
      .execute({ id: 'x' })

    const attempt = result.steps[0].attempts[0]
    expect(attempt.timing.startedAt).toBeGreaterThan(0)
    expect(attempt.timing.finishedAt).toBeGreaterThanOrEqual(attempt.timing.startedAt)
    expect(attempt.timing.duration).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// Backoff: none (default / immediate retry)
// ---------------------------------------------------------------------------

describe('backoff: none', () => {
  it('retries immediately with no delay', async () => {
    let calls = 0
    const start = Date.now()
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('fail')
        },
        retry: { maxAttempts: 3, backoff: { type: 'none' } },
      })
      .execute({ id: 'x' })

    // 3 immediate retries should complete well under 50 ms
    expect(Date.now() - start).toBeLessThan(100)
    expect(calls).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Backoff: fixed
// ---------------------------------------------------------------------------

describe('backoff: fixed', () => {
  it('waits the configured delay between each attempt', async () => {
    let calls = 0
    const start = Date.now()
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          if (calls < 3) throw new Error('transient')
          return {}
        },
        retry: { maxAttempts: 3, backoff: { type: 'fixed', delay: 20 } },
      })
      .execute({ id: 'x' })

    // 2 delays of 20 ms each → at least 40 ms
    expect(Date.now() - start).toBeGreaterThanOrEqual(30)
    expect(calls).toBe(3)
  }, 2000)
})

// ---------------------------------------------------------------------------
// Backoff: exponential
// ---------------------------------------------------------------------------

describe('backoff: exponential', () => {
  it('doubles the delay on each subsequent failure', async () => {
    const delays: number[] = []
    let calls = 0
    const analytics = makeAnalytics()
    analytics.onStepAttempt.mockImplementation((_name, _attempt, _error, delay) => {
      delays.push(delay)
    })

    await createPipeline<Input>({ name: 'P', analytics })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('fail')
        },
        retry: {
          maxAttempts: 4,
          backoff: { type: 'exponential', initialDelay: 10, multiplier: 2 },
        },
      })
      .execute({ id: 'x' })

    // delays before attempts 2, 3, 4 → 10, 20, 40
    expect(delays).toHaveLength(3)
    expect(delays[0]).toBe(10)
    expect(delays[1]).toBe(20)
    expect(delays[2]).toBe(40)
  })

  it('uses multiplier: 2 as default', async () => {
    const delays: number[] = []
    const analytics = makeAnalytics()
    analytics.onStepAttempt.mockImplementation((_name, _attempt, _error, delay) =>
      delays.push(delay),
    )

    await createPipeline<Input>({ name: 'P', analytics })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 3, backoff: { type: 'exponential', initialDelay: 10 } },
      })
      .execute({ id: 'x' })

    expect(delays[0]).toBe(10)
    expect(delays[1]).toBe(20)
  })
})

// ---------------------------------------------------------------------------
// Backoff: steps
// ---------------------------------------------------------------------------

describe('backoff: steps', () => {
  it('uses explicit per-attempt delays', async () => {
    const delays: number[] = []
    const analytics = makeAnalytics()
    analytics.onStepAttempt.mockImplementation((_n, _a, _e, delay) => delays.push(delay))

    await createPipeline<Input>({ name: 'P', analytics })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 4, backoff: { type: 'steps', delays: [5, 10, 30] } },
      })
      .execute({ id: 'x' })

    // 3 delays before attempts 2, 3, 4 → 5, 10, 30
    expect(delays).toEqual([5, 10, 30])
  })

  it('repeats the last delay when maxAttempts exceeds delays.length', async () => {
    const delays: number[] = []
    const analytics = makeAnalytics()
    analytics.onStepAttempt.mockImplementation((_n, _a, _e, delay) => delays.push(delay))

    await createPipeline<Input>({ name: 'P', analytics })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 5, backoff: { type: 'steps', delays: [5, 10] } },
      })
      .execute({ id: 'x' })

    // delays: 5, 10, 10, 10
    expect(delays).toEqual([5, 10, 10, 10])
  })
})

// ---------------------------------------------------------------------------
// maxDelay cap
// ---------------------------------------------------------------------------

describe('retry.maxDelay', () => {
  it('clamps individual delays to maxDelay', async () => {
    const delays: number[] = []
    const analytics = makeAnalytics()
    analytics.onStepAttempt.mockImplementation((_n, _a, _e, delay) => delays.push(delay))

    await createPipeline<Input>({ name: 'P', analytics })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('fail')
        },
        retry: {
          maxAttempts: 4,
          backoff: { type: 'exponential', initialDelay: 10, multiplier: 4 },
          maxDelay: 25,
        },
      })
      .execute({ id: 'x' })

    // uncapped: 10, 40, 160 → capped to 10, 25, 25
    expect(delays).toEqual([10, 25, 25])
  })
})

// ---------------------------------------------------------------------------
// maxTotalDelay cap
// ---------------------------------------------------------------------------

describe('retry.maxTotalDelay', () => {
  it('stops retrying when cumulative delay would exceed maxTotalDelay', async () => {
    let calls = 0
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('fail')
        },
        retry: {
          maxAttempts: 10,
          backoff: { type: 'fixed', delay: 20 },
          maxTotalDelay: 35, // allows 1 delay (20 ms) but not 2 (40 ms)
        },
      })
      .execute({ id: 'x' })

    // First attempt fails, delay=20ms added (cumulative=20, ok).
    // Second attempt fails, delay=20ms would bring total to 40 > 35, abort.
    expect(calls).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// RetryCondition — selective retry
// ---------------------------------------------------------------------------

describe('retry.on — selective retry conditions', () => {
  it('does not retry when onError is false and execute throws', async () => {
    let calls = 0
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('err')
        },
        retry: { maxAttempts: 5, on: { onError: false } },
      })
      .execute({ id: 'x' })

    expect(calls).toBe(1) // no retry
  })

  it('does not retry on timeout when onTimeout is false', async () => {
    let calls = 0
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          return new Promise((resolve) => setTimeout(() => resolve({}), 100))
        },
        timeout: 10,
        retry: { maxAttempts: 5, on: { onTimeout: false } },
      })
      .execute({ id: 'x' })

    expect(calls).toBe(1) // timed out once, not retried
  })

  it('retries on error but not on timeout when configured', async () => {
    let calls = 0
    let isSecondAttempt = false

    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          if (!isSecondAttempt) {
            isSecondAttempt = true
            throw new Error('regular error')
          }
          // Second attempt: timeout
          return new Promise((resolve) => setTimeout(() => resolve({}), 100))
        },
        timeout: 10,
        retry: { maxAttempts: 5, on: { onError: true, onTimeout: false } },
      })
      .execute({ id: 'x' })

    // First call throws → retried (onError: true).
    // Second call times out → not retried (onTimeout: false).
    expect(calls).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// onRetry callback
// ---------------------------------------------------------------------------

describe('onRetry callback', () => {
  it('fires after each failed attempt before the final one', async () => {
    const retryCalls: Array<{ attempt: number; delay: number }> = []

    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 4, backoff: { type: 'fixed', delay: 5 } },
        onRetry: (_error, attempt, delay) => {
          retryCalls.push({ attempt, delay })
        },
      })
      .execute({ id: 'x' })

    // 3 retries → onRetry fires 3 times (after attempts 1, 2, 3)
    expect(retryCalls).toHaveLength(3)
    expect(retryCalls[0]).toEqual({ attempt: 1, delay: 5 })
    expect(retryCalls[1]).toEqual({ attempt: 2, delay: 5 })
    expect(retryCalls[2]).toEqual({ attempt: 3, delay: 5 })
  })

  it('does not fire on the final failed attempt', async () => {
    const retryCalls: number[] = []

    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 2 },
        onRetry: (_error, attempt) => {
          retryCalls.push(attempt)
        },
      })
      .execute({ id: 'x' })

    // maxAttempts=2: attempt 1 fails → onRetry fires. attempt 2 fails → no onRetry.
    expect(retryCalls).toEqual([1])
  })

  it('receives the error from the failed attempt', async () => {
    let capturedError: Error | undefined

    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('specific error')
        },
        retry: { maxAttempts: 2 },
        onRetry: (error) => {
          capturedError = error
        },
      })
      .execute({ id: 'x' })

    expect(capturedError?.message).toBe('specific error')
  })

  it('does not fire when onError is false and the retry is skipped', async () => {
    const retryCalls: number[] = []

    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 5, on: { onError: false } },
        onRetry: (_error, attempt) => {
          retryCalls.push(attempt)
        },
      })
      .execute({ id: 'x' })

    expect(retryCalls).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Analytics: onStepAttempt
// ---------------------------------------------------------------------------

describe('analytics.onStepAttempt', () => {
  it('fires for each non-final failed attempt', async () => {
    const analytics = makeAnalytics()

    await createPipeline<Input>({ name: 'P', analytics })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('err')
        },
        retry: { maxAttempts: 3 },
      })
      .execute({ id: 'x' })

    // 2 retries → onStepAttempt fires twice (after attempts 1 and 2)
    expect(analytics.onStepAttempt).toHaveBeenCalledTimes(2)
    expect(analytics.onStepAttempt).toHaveBeenNthCalledWith(
      1,
      'A',
      1,
      expect.any(Error),
      expect.any(Number),
    )
    expect(analytics.onStepAttempt).toHaveBeenNthCalledWith(
      2,
      'A',
      2,
      expect.any(Error),
      expect.any(Number),
    )
  })

  it('does not fire when the step succeeds on the first attempt', async () => {
    const analytics = makeAnalytics()

    await createPipeline<Input>({ name: 'P', analytics })
      .step({ name: 'A', execute: () => ({}) })
      .execute({ id: 'x' })

    expect(analytics.onStepAttempt).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Interaction with ContinuePolicy
// ---------------------------------------------------------------------------

describe('retry + ContinuePolicy interaction', () => {
  it('exhausts all retries, then CONTINUE policy lets subsequent steps run', async () => {
    const ranSteps: string[] = []

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'AlwaysFails',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 3 },
        policy: { error: 'CONTINUE' },
      })
      .step({
        name: 'Runs After',
        execute: () => {
          ranSteps.push('Runs After')
          return {}
        },
      })
      .execute({ id: 'x' })

    expect(result.steps[0].attempts).toHaveLength(3)
    expect(result.steps[0].executeFailed).toBe(true)
    expect(ranSteps).toContain('Runs After')
  })

  it('exhausts all retries, then STOP policy halts the pipeline', async () => {
    const ranSteps: string[] = []

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'AlwaysFails',
        execute: () => {
          throw new Error('fail')
        },
        retry: { maxAttempts: 2 },
        // default policy is STOP
      })
      .step({
        name: 'Should Not Run',
        execute: () => {
          ranSteps.push('Should Not Run')
          return {}
        },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    expect(result.steps[0].attempts).toHaveLength(2) // both retries exhausted
    expect(ranSteps).not.toContain('Should Not Run')
  })

  it('retries are internal — subsequent steps see accumulated data unchanged', async () => {
    let attempts = 0

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Flaky',
        execute: () => {
          attempts++
          if (attempts < 3) throw new Error('transient')
          return { enriched: true }
        },
        retry: { maxAttempts: 5 },
      })
      .step({ name: 'Check', execute: (ctx: any) => ({ saw: ctx.enriched }) })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.saw).toBe(true)
    expect(result.steps[0].attempts).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// restartFromStep
// ---------------------------------------------------------------------------

describe('retry.restartFromStep', () => {
  it('restarts the pipeline from an earlier step on final execute failure', async () => {
    const stepCalls: string[] = []
    let authCalls = 0

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Authenticate',
        execute: () => {
          authCalls++
          stepCalls.push('Authenticate')
          return { token: `tok${authCalls}` }
        },
      })
      .step({
        name: 'Call API',
        execute: (ctx: any) => {
          stepCalls.push('Call API')
          if (authCalls < 2) throw new Error('auth expired')
          return { result: 'ok', usedToken: ctx.token }
        },
        retry: { maxAttempts: 1, restartFromStep: 'Authenticate', maxRestarts: 1 },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
    // Authenticate ran twice (once initially, once on restart)
    expect(authCalls).toBe(2)
    expect(stepCalls).toEqual(['Authenticate', 'Call API', 'Authenticate', 'Call API'])
    expect(result.restarts).toBe(1)
  })

  it('fires analytics.onPipelineRestart with the step name and restart count', async () => {
    const analytics = makeAnalytics()

    await createPipeline<Input>({ name: 'P', analytics })
      .step({
        name: 'Init',
        execute: () => ({ initialized: true }),
      })
      .step({
        name: 'Fail Once',
        execute: (() => {
          let n = 0
          return () => {
            n++
            if (n < 2) throw new Error('fail')
            return {}
          }
        })(),
        retry: { maxAttempts: 1, restartFromStep: 'Init', maxRestarts: 1 },
      })
      .execute({ id: 'x' })

    expect(analytics.onPipelineRestart).toHaveBeenCalledTimes(1)
    expect(analytics.onPipelineRestart).toHaveBeenCalledWith('P', 'Init', 1)
  })

  it('restores accumulated data to the state before the restart step', async () => {
    let initValue = 0
    const seenValues: number[] = []

    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Init',
        execute: () => {
          initValue++
          return { counter: initValue }
        },
      })
      .step({
        name: 'Use',
        execute: (ctx: any) => {
          seenValues.push(ctx.counter)
          if (ctx.counter < 2) throw new Error('need re-init')
          return {}
        },
        retry: { maxAttempts: 1, restartFromStep: 'Init', maxRestarts: 1 },
      })
      .execute({ id: 'x' })

    // Init ran twice: counter=1 (first run), counter=2 (after restart)
    expect(seenValues).toEqual([1, 2])
  })

  it('respects maxRestarts and fails once the budget is exhausted', async () => {
    let restarts = 0

    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'Init', execute: () => ({ n: ++restarts }) })
      .step({
        name: 'AlwaysFails',
        execute: () => {
          throw new Error('forever')
        },
        retry: { maxAttempts: 1, restartFromStep: 'Init', maxRestarts: 2 },
      })
      .execute({ id: 'x' })

    // maxRestarts: 2 → Init runs 3 times (initial + 2 restarts), then pipeline fails
    expect(restarts).toBe(3)
    expect(result.success).toBe(false)
    expect(result.restarts).toBe(2)
  })

  it('throws at execute() start when restartFromStep refers to a non-existent step', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({ name: 'A', execute: () => ({}) })
        .step({
          name: 'B',
          execute: () => {
            throw new Error('fail')
          },
          retry: { maxAttempts: 1, restartFromStep: 'NoSuchStep' },
        })
        .execute({ id: 'x' }),
    ).rejects.toThrow('NoSuchStep')
  })

  it('throws at execute() start when restartFromStep points to a later step', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({ name: 'A', execute: () => ({}) })
        .step({
          name: 'B',
          execute: () => {
            throw new Error('fail')
          },
          retry: { maxAttempts: 1, restartFromStep: 1 }, // index 1 = B itself
        })
        .execute({ id: 'x' }),
    ).rejects.toThrow('earlier step')
  })

  it('supports numeric index as restartFromStep', async () => {
    let firstStepCalls = 0

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Init',
        execute: () => {
          firstStepCalls++
          return { v: firstStepCalls }
        },
      })
      .step({
        name: 'Consumer',
        execute: (ctx: any) => {
          if (ctx.v < 2) throw new Error('need re-init')
          return { ok: true }
        },
        retry: { maxAttempts: 1, restartFromStep: 0, maxRestarts: 1 },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
    expect(firstStepCalls).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// PipelineResult.restarts field
// ---------------------------------------------------------------------------

describe('PipelineResult.restarts', () => {
  it('is 0 when no restarts occur', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}) })
      .execute({ id: 'x' })

    expect(result.restarts).toBe(0)
  })

  it('counts each pipeline restart accurately', async () => {
    let n = 0

    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'Init', execute: () => ({ n: ++n }) })
      .step({
        name: 'Retry',
        execute: (ctx: any) => {
          if (ctx.n < 3) throw new Error('fail')
          return {}
        },
        retry: { maxAttempts: 1, restartFromStep: 'Init', maxRestarts: 3 },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
    expect(result.restarts).toBe(2) // restarted twice before n reached 3
  })
})

// ---------------------------------------------------------------------------
// RetryPolicy validation errors
// ---------------------------------------------------------------------------

describe('RetryPolicy validation', () => {
  it('throws when maxAttempts < 1', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({ name: 'A', execute: () => ({}), retry: { maxAttempts: 0 } })
        .execute({ id: 'x' }),
    ).rejects.toThrow('maxAttempts must be >= 1')
  })

  it('throws when maxDelay <= 0', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({ name: 'A', execute: () => ({}), retry: { maxAttempts: 2, maxDelay: 0 } })
        .execute({ id: 'x' }),
    ).rejects.toThrow('maxDelay must be > 0')
  })

  it('throws when maxTotalDelay <= 0', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({ name: 'A', execute: () => ({}), retry: { maxAttempts: 2, maxTotalDelay: 0 } })
        .execute({ id: 'x' }),
    ).rejects.toThrow('maxTotalDelay must be > 0')
  })

  it('throws when maxRestarts < 0', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({ name: 'A', execute: () => ({}), retry: { maxAttempts: 2, maxRestarts: -1 } })
        .execute({ id: 'x' }),
    ).rejects.toThrow('maxRestarts must be >= 0')
  })

  it('throws when steps backoff has empty delays array', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({
          name: 'A',
          execute: () => ({}),
          retry: { maxAttempts: 2, backoff: { type: 'steps', delays: [] } },
        })
        .execute({ id: 'x' }),
    ).rejects.toThrow('delays must not be empty')
  })

  it('throws when exponential multiplier <= 0', async () => {
    await expect(
      createPipeline<Input>({ name: 'P' })
        .step({
          name: 'A',
          execute: () => ({}),
          retry: {
            maxAttempts: 2,
            backoff: { type: 'exponential', initialDelay: 100, multiplier: 0 },
          },
        })
        .execute({ id: 'x' }),
    ).rejects.toThrow('multiplier must be > 0')
  })
})

// ---------------------------------------------------------------------------
// Legacy `retries` shorthand (backwards compat)
// ---------------------------------------------------------------------------

describe('legacy retries shorthand', () => {
  it('retries: 2 makes 3 total attempts (unchanged behaviour)', async () => {
    let calls = 0
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('fail')
        },
        retries: 2,
      })
      .execute({ id: 'x' })

    expect(calls).toBe(3)
  })

  it('retry object takes precedence over retries shorthand', async () => {
    let calls = 0
    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          calls++
          throw new Error('fail')
        },
        retries: 10, // ignored because retry is set
        retry: { maxAttempts: 2 },
      })
      .execute({ id: 'x' })

    expect(calls).toBe(2)
  })
})
