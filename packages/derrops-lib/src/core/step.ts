import {
  CheckFn,
  CheckRecord,
  CheckResult,
  StepConfig,
  StepContext,
  StepResult,
  Enrich,
  AnalyticsCollector,
} from './types'

/** Internal normalized form of a check — name resolved, fn unwrapped. */
type NormalizedCheck<TData> = { name?: string; fn: CheckFn<TData> }

/**
 * Represents a single step in a flow.
 *
 * A step holds its `StepConfig` (execute function, shouldRun guard, callbacks,
 * retries, timeout) plus an ordered list of checks added via the builder's
 * `.check()` method. Instances are created by `SequentialFlow.step()` and are
 * immutable after construction — `withCheck()` returns a new `Step` rather than
 * mutating the existing one.
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
   * Called by `SequentialFlow.check()` — not part of the public consumer API.
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
   *    `{ success: false }`. Checks do not run.
   *
   * The `analytics` collector is notified at the start, on completion, and on skip.
   *
   * @param context   - The accumulated data and metadata for this execution pass.
   * @param analytics - Lifecycle event observer provided by the parent flow.
   */
  async execute(
    context: StepContext<TAccumulated>,
    analytics: AnalyticsCollector,
  ): Promise<StepResult<Enrich<TAccumulated, TOutput>>> {
    const name = this.name
    const { execute, shouldRun, onSuccess, onFailure, retries = 0, timeout } = this.config

    if (shouldRun) {
      const should = await shouldRun(context)
      if (!should) {
        analytics.onStepSkipped(name, 'Condition not met')
        // Checks get NONE status when the step is skipped — they didn't run, not failed
        const noneChecks: CheckRecord[] = this.checks.map((check) => ({
          name: check.name,
          result: { status: 'NONE' as const, continue: true },
        }))
        return {
          success: true,
          data: context.data as Enrich<TAccumulated, TOutput>,
          analytics: { skipped: true },
          checks: noneChecks,
          allChecksPassed: true,
          shouldStop: false,
        }
      }
    }

    analytics.onStepStart(name, context.data)
    const startTime = Date.now()

    let lastError: Error | undefined

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const executeWithTimeout = timeout
          ? this.withTimeout(Promise.resolve(execute(context.data)), timeout)
          : Promise.resolve(execute(context.data))

        const result = await executeWithTimeout
        const duration = Date.now() - startTime

        const enrichedData: Enrich<TAccumulated, TOutput> = { ...context.data, ...result }

        await onSuccess?.(result, context.data)

        // All checks for this step always run, even if an earlier check sets
        // shouldStop. This ensures every check is recorded before the flow halts,
        // giving callers the full picture for diagnostics and audit logging.
        const checkRecords: CheckRecord[] = []
        let allChecksPassed = true
        let shouldStop = false

        for (const check of this.checks) {
          let checkResult: CheckResult
          try {
            const fnResult = await check.fn(enrichedData)
            checkResult = {
              status: fnResult.success ? 'PASS' : 'FAIL',
              message: fnResult.message,
              continue: fnResult.continue,
            }
          } catch (err) {
            // An unexpected throw in a check fn is recorded as ERROR with
            // continue: false so the flow stops rather than silently proceeding
            // with an unknown check outcome.
            const checkError = err instanceof Error ? err : new Error(String(err))
            checkResult = {
              status: 'ERROR',
              message: checkError.message,
              continue: false,
              error: checkError,
            }
          }

          checkRecords.push({ name: check.name, result: checkResult })

          if (checkResult.status !== 'PASS') {
            allChecksPassed = false
            if (!checkResult.continue) {
              shouldStop = true
            }
          }
        }

        const stepResult: StepResult<Enrich<TAccumulated, TOutput>> = {
          success: true,
          data: enrichedData,
          analytics: { attempts: attempt + 1, duration },
          checks: checkRecords,
          allChecksPassed,
          shouldStop,
        }

        analytics.onStepComplete(name, stepResult, duration)

        return stepResult
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === retries) {
          const duration = Date.now() - startTime
          await onFailure?.(lastError, context.data)

          const stepResult: StepResult<Enrich<TAccumulated, TOutput>> = {
            success: false,
            error: lastError,
            analytics: { attempts: attempt + 1, duration },
          }

          analytics.onStepComplete(name, stepResult, duration)

          return stepResult
        }
      }
    }

    throw lastError!
  }

  /**
   * Races `promise` against a rejection timer.
   * Used to enforce `StepConfig.timeout` on individual execute attempts.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
      ),
    ])
  }
}
