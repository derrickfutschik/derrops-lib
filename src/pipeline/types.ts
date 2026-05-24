/**
 * Merges accumulated step data with a new step's output into a single flat type.
 *
 * Used internally to widen the `TAccumulated` type parameter as each step is
 * added to a pipeline. Consumers rarely need to reference this directly.
 *
 * @template TAccumulated - Data collected from all steps so far
 * @template TNew - Data produced by the next step
 *
 * @example
 * type After2Steps = Enrich<{ userId: string }, { userName: string }>
 * // → { userId: string; userName: string }
 */
export type Enrich<TAccumulated, TNew> = TAccumulated & TNew

/**
 * Controls what the pipeline does when a specific failure mode occurs on a step.
 * All fields default to `'STOP'` — omit a field to keep the default.
 *
 * @property error   - `execute` threw an exception (non-timeout). Default: `STOP`.
 * @property failure - A check returned `success: false`. Default: `STOP`.
 * @property timeout - `execute` exceeded its configured `timeout`. Default: `STOP`.
 *
 * @example
 * // Keep running after check failures so subsequent steps can enrich the context
 * policy: { failure: 'CONTINUE' }
 *
 * // Keep running after any kind of step failure
 * policy: { error: 'CONTINUE', failure: 'CONTINUE', timeout: 'CONTINUE' }
 */
export type ContinuePolicyValue = 'CONTINUE' | 'STOP'

export type ContinuePolicy = {
  error?: ContinuePolicyValue
  failure?: ContinuePolicyValue
  timeout?: ContinuePolicyValue
}

/**
 * Execution context passed to `shouldRun` predicates.
 *
 * `data` holds everything accumulated from the initial input plus all
 * previously completed steps. `metadata` carries bookkeeping about where
 * in the pipeline execution is currently.
 *
 * @template TData - The accumulated data type at the point this context is created
 */
export type StepContext<TData = unknown> = {
  /** All data accumulated up to (but not including) the current step. */
  data: TData
  metadata: {
    /** Display name of the step that is about to run. */
    stepName: string
    /** Unix timestamp (ms) when this step's execution began. */
    startTime: number
    /** Names of every step that completed before this one. */
    previousSteps: string[]
  }
}

/**
 * The value a check function must return.
 *
 * The framework converts this to a `CheckResult` (with a `CheckStatus`) before
 * recording it — callers never interact with `CheckFnResult` directly after the
 * check function returns.
 *
 * Whether a failing check stops the pipeline is controlled by the step's
 * `policy.failure` setting, not by the check return value itself.
 *
 * @property success - Whether the business-logic assertion passed.
 * @property message - Optional human-readable reason, surfaced in `CheckResult.message`
 *                     and used as the pipeline error message when the step policy stops
 *                     the pipeline.
 */
export type CheckFnResult = {
  success: boolean
  message?: string
}

/**
 * Rich status recorded for each check after execution.
 *
 * | Status  | Meaning                                                        |
 * |---------|----------------------------------------------------------------|
 * | `PASS`  | Check ran and `success` was `true`                             |
 * | `FAIL`  | Check ran and `success` was `false`                            |
 * | `ERROR` | Check function threw an unexpected error                       |
 * | `NONE`  | Check did not run because its step was skipped via `shouldRun` |
 */
export type CheckStatus = 'PASS' | 'FAIL' | 'ERROR' | 'NONE'

/**
 * The recorded outcome of a single check, stored in `CheckRecord.result`.
 *
 * Inspect `status` first to understand what happened, then use `message` and
 * `error` for diagnostics. Whether the pipeline stopped after this check is
 * determined by the step's `ContinuePolicy`, not stored here.
 *
 * @property status  - One of `PASS | FAIL | ERROR | NONE` (see `CheckStatus`).
 * @property message - Human-readable description of the outcome, sourced from
 *                     `CheckFnResult.message` or the thrown error's message.
 * @property error   - The thrown `Error` object. Present only when `status` is `ERROR`.
 */
export type CheckResult = {
  status: CheckStatus
  message?: string
  error?: Error
}

/**
 * A function that inspects the fully enriched step context and returns a
 * `CheckFnResult` indicating whether the assertion passed.
 *
 * The `ctx` argument is the merged object of all accumulated data plus the
 * current step's output — every field from previous steps and this step is
 * available at the top level.
 *
 * The optional `steps` argument contains the fully completed `StepRecord` for
 * every step that finished before the current one. Use it to branch on earlier
 * outcomes without re-querying data.
 *
 * @template TData - The enriched data type at the point the check runs
 *
 * @example
 * const isWhitelisted: CheckFn<{ ip: string; whitelist: string[] }> =
 *   (ctx) => ({ success: ctx.whitelist.includes(ctx.ip) })
 *
 * @example
 * // Skip the check when a preceding step was skipped
 * const onlyIfFetched: CheckFn<{ user?: User }> =
 *   (ctx, steps) => ({
 *     success: steps?.find(s => s.name === 'Fetch User')?.skipped
 *       ? true
 *       : ctx.user != null,
 *   })
 */
export type CheckFn<TData> = (
  ctx: TData,
  steps?: readonly StepRecord[],
) => CheckFnResult | Promise<CheckFnResult>

/**
 * A single entry in `StepRecord.checks`, pairing an optional display name with
 * the recorded `CheckResult` for that check.
 *
 * @property name   - The name passed to `.check(name, fn)`, or `undefined` for anonymous checks.
 * @property result - The full `CheckResult` including status, message, and any thrown error.
 */
export type CheckRecord = {
  name?: string
  result: CheckResult
}

/**
 * Summary of a single step's execution, included in `PipelineResult.steps`.
 *
 * Every step that was visited during a pipeline run — including skipped and
 * failed ones — produces a `StepRecord`. Steps where `execute` threw will
 * have an empty `checks` array because checks only run after a successful
 * execute.
 *
 * @property name    - Display name of the step.
 * @property skipped - `true` when `shouldRun` returned `false` and the step was bypassed.
 * @property checks  - Ordered list of check outcomes. Empty if execute threw or no checks
 *                     were attached. NONE-status records are present for skipped steps.
 */
export type StepRecord = {
  name: string
  skipped: boolean
  checks: CheckRecord[]
}

/**
 * Internal result produced by `Step.execute()` and consumed by `SequentialPipeline`.
 *
 * Not part of the public API — use `PipelineResult` for the value returned by
 * `pipeline.execute()`.
 *
 * The discriminated union lets the pipeline distinguish between an unhandled
 * execute error (`success: false`) and a successful execute where checks may
 * still have failed (`success: true` with `allChecksPassed: false`).
 *
 * `shouldStop` is set on both branches: the step resolves its own `ContinuePolicy`
 * so the pipeline can remain policy-agnostic and simply read this flag.
 *
 * @template TOutput - The enriched data type this step produced
 */
export type StepResult<TOutput = unknown> =
  | {
      success: true
      /** Fully enriched data: accumulated input merged with this step's output. */
      data: TOutput
      analytics?: Record<string, unknown>
      /** All check records for this step, in the order they ran. */
      checks: CheckRecord[]
      /** `false` if any check has status FAIL or ERROR. */
      allChecksPassed: boolean
      /** `true` when the step's policy says to halt the pipeline. */
      shouldStop: boolean
    }
  | {
      success: false
      /** The error thrown by `execute` (or the final retry attempt). */
      error: Error
      analytics?: Record<string, unknown>
      /** `true` when the step's policy says to halt the pipeline. */
      shouldStop: boolean
    }

/**
 * The value returned by `pipeline.execute()`.
 *
 * `data` is always present — even when `success` is `false` — so callers can
 * inspect the fully enriched context regardless of outcome. This is intentional:
 * pipelines used for access control or audit logging need the enriched data to
 * record what was learned before a denial decision was made.
 *
 * ```typescript
 * const result = await pipeline.execute(input)
 *
 * // Always safe to read enriched data:
 * console.log(result.data)
 *
 * // Narrow for type-safe access to error:
 * if (!result.success) {
 *   console.error(result.error.message)
 * }
 * ```
 *
 * @template TData - The fully accumulated data type after all steps
 */
export type PipelineResult<TData = unknown> =
  | { success: true; data: TData; steps: StepRecord[] }
  | {
      success: false
      data: TData
      /** Describes the first halting failure: a thrown execute error or the first
       *  failing check message on a step whose policy is `failure: 'STOP'`. */
      error: Error
      steps: StepRecord[]
    }

/**
 * Predicate that decides whether a step should execute.
 *
 * Return `false` (or a Promise resolving to `false`) to skip the step. The
 * accumulated data passes through unchanged and all attached checks are
 * recorded with status `NONE`.
 *
 * @template TInput - Accumulated data type at the point this predicate runs
 *
 * @example
 * shouldRun: (ctx) => ctx.data.lintErrors === 0
 */
export type StepCondition<TInput = unknown> = (
  context: StepContext<TInput>,
) => boolean | Promise<boolean>

/**
 * Observer interface for step and pipeline lifecycle events.
 *
 * Pass an implementation via `PipelineConfig.analytics` to collect timing,
 * trace steps, or integrate with external monitoring. All methods are
 * called synchronously from within `Step.execute()` and `SequentialPipeline.execute()`.
 *
 * A default no-op implementation is used when no analytics are provided.
 */
export type AnalyticsCollector = {
  /** Fired immediately before a step's `execute` function is called. */
  onStepStart: (stepName: string, input: unknown) => void
  /** Fired after `execute` completes (success or failure) and after all checks run. */
  onStepComplete: (stepName: string, result: StepResult, duration: number) => void
  /** Fired when `shouldRun` returned `false` and the step was bypassed. */
  onStepSkipped: (stepName: string, reason: string) => void
  /** Fired after all steps complete and the pipeline is about to return its result. */
  onPipelineComplete: (pipelineName: string, totalDuration: number) => void
  /** Fired when an unexpected error escapes the pipeline's own error handling. */
  onPipelineError: (pipelineName: string, error: Error) => void
}

/**
 * Configuration for a single step passed to `.step()`.
 *
 * The only required field is `execute`. All other fields are optional and add
 * conditional execution, lifecycle callbacks, retry logic, timeouts, and
 * failure-continuation policy.
 *
 * @template TAccumulated - All data accumulated before this step runs
 * @template TOutput      - The new data shape this step produces
 *
 * @property name      - Display name shown in analytics and `StepRecord`. Defaults to `"Step N"`.
 * @property execute   - The core function. Receives all accumulated data and returns new data
 *                       to merge. May be async. Throwing here triggers `onFailure` and retries.
 * @property shouldRun - Optional guard called before `execute`. Return `false` to skip the step.
 * @property onSuccess - Called after a successful `execute`, before checks run.
 *                       Receives the raw step output and the pre-merge accumulated data.
 * @property onFailure - Called after the final failed attempt (all retries exhausted).
 *                       Receives the thrown error and the accumulated data at the time of failure.
 * @property retries   - Number of additional attempts on failure. `0` means one attempt total.
 * @property timeout   - Maximum milliseconds for a single `execute` attempt. Exceeding it
 *                       counts as a failure and triggers the retry/onFailure path.
 * @property policy    - Controls what happens when this step fails. All fields default to
 *                       `'STOP'`. Set individual fields to `'CONTINUE'` to let the pipeline
 *                       keep running after that failure mode.
 */
export type StepConfig<TAccumulated, TOutput> = {
  name?: string
  execute: (input: TAccumulated, steps?: readonly StepRecord[]) => Promise<TOutput> | TOutput
  shouldRun?: StepCondition<TAccumulated>
  onSuccess?: (output: TOutput, accumulated: TAccumulated) => void | Promise<void>
  onFailure?: (error: Error, input: TAccumulated) => void | Promise<void>
  retries?: number
  timeout?: number
  policy?: ContinuePolicy
}

/**
 * Top-level configuration for a pipeline, passed to `createPipeline()`.
 *
 * @property name      - Human-readable name used in analytics events and error messages.
 * @property analytics - Optional observer for step/pipeline lifecycle events.
 *                       Defaults to a no-op implementation.
 */
export type PipelineConfig = {
  name: string
  analytics?: AnalyticsCollector
}
