import {
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
 * retries, timeout, policy) plus an ordered list of checks added via the
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
   * 2. Call `execute` (with optional timeout wrapping and retry loop).
   * 3. On success: merge output into accumulated data, then run all checks in
   *    order. Each check is wrapped in its own try/catch — a throwing check
   *    produces an `ERROR` record rather than aborting the remaining checks.
   * 4. On execute failure (all retries exhausted): call `onFailure` and return
   *    a result whose `shouldStop` reflects `policy.error` / `policy.timeout`.
   *
   * All checks on a step always run to completion regardless of failure — the
   * step only signals `shouldStop` after every check has been recorded.
   *
   * The `analytics` collector is notified at the start, on completion, and on skip.
   *
   * @param context   - The accumulated data and metadata for this execution pass.
   * @param analytics - Lifecycle event observer provided by the parent pipeline.
   */
  async execute(
    context: StepContext<TAccumulated>,
    analytics: AnalyticsCollector,
    previousStepRecords: readonly StepRecord[] = [],
  ): Promise<StepResult<Enrich<TAccumulated, TOutput>>> {
    const startedAt = Date.now()
    const name = this.name
    const { execute, shouldRun, onSuccess, onFailure, retries = 0, timeout } = this.config
    const policy: ResolvedPolicy = { ...DEFAULT_POLICY, ...this.config.policy }

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
          data: context.data as Enrich<TAccumulated, TOutput>,
          analytics: { skipped: true },
          checks: noneChecks,
          allChecksPassed: true,
          shouldStop: false,
          terminal: false,
          timing: { startedAt, finishedAt, duration: finishedAt - startedAt },
        }
      }
    }

    analytics.onStepStart(name, context.data)
    const startTime = Date.now()

    let lastError: Error | undefined
    let lastAttempt = 0

    for (let attempt = 0; attempt <= retries; attempt++) {
      lastAttempt = attempt
      try {
        const executeWithTimeout = timeout
          ? this.withTimeout(Promise.resolve(execute(context.data, previousStepRecords)), timeout)
          : Promise.resolve(execute(context.data, previousStepRecords))

        const result = await executeWithTimeout
        const duration = Date.now() - startTime

        const enrichedData: Enrich<TAccumulated, TOutput> = { ...context.data, ...result }

        await onSuccess?.(result, context.data)

        // All checks run in order. A TERMINAL check stops the loop immediately —
        // remaining checks are recorded as NONE. Non-terminal checks always run
        // to completion before the pipeline evaluates whether to halt.
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
          data: enrichedData,
          analytics: { attempts: attempt + 1, duration },
          checks: checkRecords,
          allChecksPassed,
          shouldStop,
          terminal,
          timing: { startedAt, finishedAt, duration: finishedAt - startedAt },
        }

        analytics.onStepComplete(name, stepResult, duration)

        return stepResult
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    // All attempts exhausted — build the failure result outside the loop so TypeScript
    // sees an unconditional return path.
    const failedError = lastError!
    const duration = Date.now() - startTime
    await onFailure?.(failedError, context.data)

    const isTimeout = failedError instanceof StepTimeoutError
    const shouldStop = isTimeout ? policy.timeout === 'STOP' : policy.error === 'STOP'
    const finishedAt = Date.now()
    const noneChecks: CheckRecord[] = this.checks.map((check) => ({
      name: check.name,
      result: { status: 'NONE' as const },
    }))

    const stepResult: StepResult<Enrich<TAccumulated, TOutput>> = {
      success: false,
      error: failedError,
      shouldStop,
      checks: noneChecks,
      analytics: { attempts: lastAttempt + 1, duration },
      timing: { startedAt, finishedAt, duration: finishedAt - startedAt },
    }

    analytics.onStepComplete(name, stepResult, duration)

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
