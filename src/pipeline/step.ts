import {
  AttemptRecord,
  CheckFn,
  CheckRecord,
  CheckResult,
  ContinuePolicy,
  StepConfig,
  StepContext,
  StepRecord,
  StepResult,
  Enrich,
  AnalyticsCollector,
} from './types'
import { computeDelay, sleep, validateRetryPolicy } from './retry'

/** Internal normalized form of a check — name resolved, fn unwrapped. */
type NormalizedCheck<TData> = { name?: string; fn: CheckFn<TData> }

/** Resolved policy with all fields filled in — no optionals. */
type ResolvedPolicy = Required<ContinuePolicy>

const DEFAULT_POLICY: ResolvedPolicy = { error: 'STOP', failure: 'STOP', timeout: 'STOP' }

/**
 * Thrown by `withTimeout` so the step can distinguish a timeout from a regular
 * execute error when evaluating `policy.timeout` vs `policy.error`.
 */
export class StepTimeoutError extends Error {
  constructor(ms: number) {
    super(`Timeout after ${ms}ms`)
    this.name = 'StepTimeoutError'
  }
}

/**
 * Represents a single step in a pipeline.
 *
 * A step holds its `StepConfig` (execute function, shouldRun guard, callbacks,
 * retry policy, timeout, policy) plus an ordered list of checks added via the
 * builder's `.check()` method. Instances are created by `SequentialPipeline.step()`
 * and are immutable after construction — `withCheck()` returns a new `Step`
 * rather than mutating the existing one.
 *
 * @template TAccumulated - All data present before this step runs
 * @template TOutput      - The new data shape produced by this step's `execute`
 */
export class Step<TAccumulated, TOutput> {
  private checks: NormalizedCheck<Enrich<TAccumulated, TOutput>>[] = []

  constructor(
    private config: StepConfig<TAccumulated, TOutput>,
    private index: number = 0,
  ) {}

  /**
   * The display name for this step.
   * Falls back to `"Step N"` (zero-indexed) when no name was provided in config.
   */
  get name(): string {
    return this.config.name ?? `Step ${this.index}`
  }

  /** The `restartFromStep` target from `retry`, if configured. */
  get retryRestartTarget(): string | number | undefined {
    return this.config.retry?.restartFromStep
  }

  /** Maximum pipeline restarts allowed for this step's `restartFromStep`. Default: 1. */
  get maxRestarts(): number {
    return this.config.retry?.maxRestarts ?? 1
  }

  /** Validates the `retry` policy if one is configured. Throws on invalid config. */
  validateRetry(): void {
    if (this.config.retry) validateRetryPolicy(this.name, this.config.retry)
  }

  /**
   * Returns a new `Step` with the given check appended to the end of the
   * check list. The original step is not modified.
   *
   * Called by `SequentialPipeline.check()` — not part of the public consumer API.
   *
   * @param name - Optional display name for the check, shown in `CheckRecord`.
   * @param fn   - The check function to append.
   */
  withCheck(
    name: string | undefined,
    fn: CheckFn<Enrich<TAccumulated, TOutput>>,
  ): Step<TAccumulated, TOutput> {
    const next = new Step(this.config, this.index)
    next.checks = [...this.checks, { name, fn }]
    return next
  }

  /**
   * Runs the step against the given context and returns a `StepResult`.
   *
   * Execution order:
   * 1. Evaluate `shouldRun`. If `false`, return immediately with enriched data
   *    unchanged and all checks recorded as `NONE`.
   * 2. Call `execute` up to `retry.maxAttempts` times. Between attempts,
   *    fire `onRetry`, wait for the configured backoff delay, and respect
   *    `maxDelay` / `maxTotalDelay` caps.
   * 3. On success: merge output into accumulated data, call `onSuccess`, then
   *    run all checks in order.
   * 4. On execute failure (all attempts exhausted): call `onFailure` and return
   *    a result whose `shouldStop` reflects `policy.error` / `policy.timeout`.
   *
   * The `analytics` collector is notified at the start, on each failed attempt
   * (before the delay), on completion, and on skip.
   *
   * @param context              - The accumulated data and metadata for this execution pass.
   * @param analytics            - Lifecycle event observer provided by the parent pipeline.
   * @param previousStepRecords  - Records for all steps that ran before this one.
   */
  async execute(
    context: StepContext<TAccumulated>,
    analytics: AnalyticsCollector,
    previousStepRecords: readonly StepRecord[] = [],
  ): Promise<StepResult<Enrich<TAccumulated, TOutput>>> {
    const startedAt = Date.now()
    const name = this.name
    const { execute, shouldRun, onSuccess, onFailure, onRetry, timeout } = this.config
    const policy: ResolvedPolicy = { ...DEFAULT_POLICY, ...this.config.policy }

    // ── shouldRun guard ──────────────────────────────────────────────────────
    if (shouldRun) {
      const should = await shouldRun(context)
      if (!should) {
        analytics.onStepSkipped(name, 'Condition not met')
        const noneChecks: CheckRecord[] = this.checks.map((check) => ({
          name: check.name,
          result: { status: 'NONE' as const },
        }))
        const finishedAt = Date.now()
        return {
          success: true,
          skipped: true,
          data: context.data as Enrich<TAccumulated, TOutput>,
          attemptRecords: [],
          checks: noneChecks,
          allChecksPassed: true,
          shouldStop: false,
          terminal: false,
          timing: { startedAt, finishedAt, duration: finishedAt - startedAt },
        }
      }
    }

    analytics.onStepStart(name, context.data)

    // ── Resolve retry config ─────────────────────────────────────────────────
    const retryPolicy = this.config.retry

    const maxAttempts =
      retryPolicy?.maxAttempts ?? (this.config.retries !== undefined ? this.config.retries + 1 : 1)
    const backoff = retryPolicy?.backoff ?? { type: 'none' as const }
    const retryOn = retryPolicy?.on

    // ── Retry loop ───────────────────────────────────────────────────────────
    const attemptRecords: AttemptRecord[] = []
    let lastError: Error | undefined
    let cumulativeDelay = 0

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptStartedAt = Date.now()
      let output: TOutput | undefined
      let attemptError: Error | undefined

      try {
        const executePromise = timeout
          ? this.withTimeout(Promise.resolve(execute(context.data, previousStepRecords)), timeout)
          : Promise.resolve(execute(context.data, previousStepRecords))
        output = await executePromise
      } catch (err) {
        attemptError = err instanceof Error ? err : new Error(String(err))
      }

      const attemptFinishedAt = Date.now()
      const attemptTiming: import('./types').Timing = {
        startedAt: attemptStartedAt,
        finishedAt: attemptFinishedAt,
        duration: attemptFinishedAt - attemptStartedAt,
      }

      if (attemptError === undefined) {
        // ── Execute succeeded ────────────────────────────────────────────────
        attemptRecords.push({ attempt, timedOut: false, timing: attemptTiming })

        const enrichedData: Enrich<TAccumulated, TOutput> = { ...context.data, ...output! }
        await onSuccess?.(output!, context.data)

        // Run checks — a TERMINAL check short-circuits the rest.
        const checkRecords: CheckRecord[] = []
        let allChecksPassed = true
        let shouldStop = false
        let terminal = false

        for (const check of this.checks) {
          let checkResult: CheckResult
          try {
            const fnResult = await check.fn(enrichedData, previousStepRecords)
            if (fnResult.terminal) {
              checkResult = { status: 'TERMINAL', message: fnResult.message }
            } else {
              checkResult = {
                status: fnResult.success ? 'PASS' : 'FAIL',
                message: fnResult.message,
              }
            }
          } catch (err) {
            const checkError = err instanceof Error ? err : new Error(String(err))
            checkResult = { status: 'ERROR', message: checkError.message, error: checkError }
          }

          checkRecords.push({ name: check.name, result: checkResult })

          if (checkResult.status === 'TERMINAL') {
            for (const remaining of this.checks.slice(checkRecords.length)) {
              checkRecords.push({ name: remaining.name, result: { status: 'NONE' } })
            }
            terminal = true
            allChecksPassed = false
            shouldStop = true
            break
          }

          if (checkResult.status === 'FAIL' && policy.failure === 'STOP') shouldStop = true
          if (checkResult.status === 'ERROR' && policy.error === 'STOP') shouldStop = true
          if (checkResult.status !== 'PASS') allChecksPassed = false
        }

        const finishedAt = Date.now()
        const stepResult: StepResult<Enrich<TAccumulated, TOutput>> = {
          success: true,
          skipped: false,
          data: enrichedData,
          attemptRecords,
          checks: checkRecords,
          allChecksPassed,
          shouldStop,
          terminal,
          timing: { startedAt, finishedAt, duration: finishedAt - startedAt },
        }

        analytics.onStepComplete(name, stepResult, finishedAt - startedAt)
        return stepResult
      }

      // ── Attempt failed ───────────────────────────────────────────────────
      const isTimeout = attemptError instanceof StepTimeoutError
      attemptRecords.push({
        attempt,
        error: attemptError,
        timedOut: isTimeout,
        timing: attemptTiming,
      })
      lastError = attemptError

      if (attempt < maxAttempts) {
        // Determine whether this error type should be retried.
        const shouldRetryOnError = !isTimeout && (retryOn?.onError ?? true)
        const shouldRetryOnTimeout = isTimeout && (retryOn?.onTimeout ?? true)

        if (!shouldRetryOnError && !shouldRetryOnTimeout) {
          break // This failure mode is not retried — exhaust immediately.
        }

        // Compute backoff delay for this attempt.
        let delay = computeDelay(backoff, attempt - 1)
        if (retryPolicy?.maxDelay !== undefined) {
          delay = Math.min(delay, retryPolicy.maxDelay)
        }

        // Abort retry loop if cumulative delay would exceed the budget.
        if (
          retryPolicy?.maxTotalDelay !== undefined &&
          cumulativeDelay + delay > retryPolicy.maxTotalDelay
        ) {
          break
        }
        cumulativeDelay += delay

        // Notify before sleeping.
        await onRetry?.(attemptError, attempt, delay, context.data)
        analytics.onStepAttempt(name, attempt, attemptError, delay)

        await sleep(delay)
      }
    }

    // ── All attempts exhausted ───────────────────────────────────────────────
    const failedError = lastError!
    await onFailure?.(failedError, context.data)

    const isTimeout = failedError instanceof StepTimeoutError
    const shouldStop = isTimeout ? policy.timeout === 'STOP' : policy.error === 'STOP'

    const noneChecks: CheckRecord[] = this.checks.map((check) => ({
      name: check.name,
      result: { status: 'NONE' as const },
    }))

    const finishedAt = Date.now()
    const stepResult: StepResult<Enrich<TAccumulated, TOutput>> = {
      success: false,
      error: failedError,
      attemptRecords,
      shouldStop,
      checks: noneChecks,
      timing: { startedAt, finishedAt, duration: finishedAt - startedAt },
    }

    analytics.onStepComplete(name, stepResult, finishedAt - startedAt)
    return stepResult
  }

  /** Races `promise` against a `StepTimeoutError` so timeouts are distinguishable from errors. */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new StepTimeoutError(ms)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!))
  }
}
