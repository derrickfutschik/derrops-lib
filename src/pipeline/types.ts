/**
 * Merges accumulated step data with a new step's output into a single flat type.
 *
 * Used internally to widen the `TAccumulated` type parameter as each step is
 * added to a pipeline. Consumers rarely need to reference this directly.
 *
 * **Key-shadowing warning:** if `TNew` contains a key already present in
 * `TAccumulated`, TypeScript resolves that key to `never` in the intersection.
 * This silently breaks downstream type inference. Rename the output key to avoid it.
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
 * This is evaluated **after all retry attempts are exhausted**. If a step
 * has a `RetryPolicy`, retries run first; only then does `ContinuePolicy`
 * decide whether the pipeline halts or proceeds.
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
 * Delay strategy applied between retry attempts.
 *
 * | Type            | Behaviour                                                              |
 * |-----------------|------------------------------------------------------------------------|
 * | `none`          | Retry immediately with no delay (default)                              |
 * | `fixed`         | Same `delay` ms before every attempt                                   |
 * | `exponential`   | `initialDelay * multiplier^N` where N is the 0-based failure index     |
 * | `steps`         | Explicit per-attempt delays; last value repeats once exhausted         |
 *
 * @example
 * // Double the wait after each failure, starting at 200 ms, capped at 5 s
 * backoff: { type: 'exponential', initialDelay: 200 }
 * // with maxDelay: 5000 on the RetryPolicy
 *
 * @example
 * // Explicit cadence: 1 s, 5 s, 15 s, then 15 s for any further retries
 * backoff: { type: 'steps', delays: [1000, 5000, 15000] }
 */
export type BackoffStrategy =
  | { type: 'none' }
  | { type: 'fixed'; delay: number }
  | { type: 'exponential'; initialDelay: number; multiplier?: number }
  | { type: 'steps'; delays: number[] }

/**
 * Controls which failure modes trigger a retry attempt.
 *
 * Both fields default to `true` — set a field to `false` to prevent retries
 * on that failure mode (letting the step fail immediately and deferring to
 * `ContinuePolicy`).
 *
 * @property onError   - Retry when `execute` throws a non-timeout error. Default: `true`.
 * @property onTimeout - Retry when `execute` exceeds its `timeout`. Default: `true`.
 */
export type RetryCondition = {
  onError?: boolean
  onTimeout?: boolean
}

/**
 * Full retry policy for a step, configured via `StepConfig.retry`.
 *
 * Retries run **before** `ContinuePolicy` is evaluated. If all attempts
 * are exhausted and the step still fails, `ContinuePolicy` then decides
 * whether the pipeline halts or continues.
 *
 * `restartFromStep` is a special escape hatch: instead of halting the
 * pipeline after all retries, the pipeline rewinds to an earlier step and
 * re-runs from there. This is useful when a failure at step N means earlier
 * work (e.g. token refresh at step M) needs to be repeated before step N
 * can be retried as part of the full sequence.
 *
 * @property maxAttempts    - Total execute calls including the first (min 1).
 *                            `maxAttempts: 1` means no retry; `3` means 2 retries.
 * @property backoff        - Delay strategy between attempts. Default: `{ type: 'none' }`.
 * @property on             - Which failure modes are retried. Default: both `onError`
 *                            and `onTimeout` are `true`.
 * @property maxDelay       - Clamps any single inter-attempt delay to at most this many ms.
 *                            Guards against unreasonably large waits from exponential backoff.
 * @property maxTotalDelay  - Aborts the retry loop if the cumulative delay across all
 *                            attempts would exceed this value. The failing attempt is not
 *                            retried; the step fails immediately.
 * @property restartFromStep - On final execute failure (all attempts exhausted), instead
 *                             of halting the pipeline, rewind to this step (by name or
 *                             0-based index) and re-run from there. The target must be
 *                             an earlier step. Only triggers when `ContinuePolicy.error`
 *                             would be `STOP`; steps with `policy.error: 'CONTINUE'` skip
 *                             this and proceed normally.
 * @property maxRestarts    - Maximum number of pipeline restarts via `restartFromStep`.
 *                            Default: `1`. Prevents infinite restart loops.
 *
 * @example
 * retry: {
 *   maxAttempts: 4,
 *   backoff: { type: 'exponential', initialDelay: 250 },
 *   maxDelay: 10_000,
 *   maxTotalDelay: 30_000,
 *   on: { onError: true, onTimeout: false },
 * }
 *
 * @example
 * // Restart from 'Authenticate' when 'Call API' exhausts its retries
 * retry: {
 *   maxAttempts: 3,
 *   backoff: { type: 'fixed', delay: 500 },
 *   restartFromStep: 'Authenticate',
 *   maxRestarts: 2,
 * }
 */
export type RetryPolicy = {
  maxAttempts: number
  backoff?: BackoffStrategy
  on?: RetryCondition
  maxDelay?: number
  maxTotalDelay?: number
  restartFromStep?: string | number
  maxRestarts?: number
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
  /** When `true`, stops all remaining checks and forces pipeline failure regardless of success criteria. */
  terminal?: true
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
 * | `NONE`     | Check did not run because its step was skipped via `shouldRun`, or because an earlier check on the same step was `TERMINAL` |
 * | `TERMINAL` | Check explicitly halted the pipeline — overrides success criteria, remaining checks skipped                          |
 */
export type CheckStatus = 'PASS' | 'FAIL' | 'ERROR' | 'NONE' | 'TERMINAL'

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
  steps: readonly StepRecord[],
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
 * Timing metrics captured for a step or the pipeline as a whole.
 *
 * @property startedAt  - Unix timestamp (ms) when execution began.
 * @property finishedAt - Unix timestamp (ms) when execution completed.
 * @property duration   - Elapsed milliseconds (`finishedAt - startedAt`).
 */
export type Timing = {
  startedAt: number
  finishedAt: number
  duration: number
}

/**
 * Timing and outcome for a single execute attempt within a step.
 *
 * Steps with a `RetryPolicy` may make multiple attempts. Each attempt produces
 * one `AttemptRecord`, stored in `StepRecord.attempts`. A step that succeeds
 * on the first try has exactly one record; a step that retries twice before
 * succeeding has three records.
 *
 * @property attempt  - 1-based attempt number.
 * @property error    - The error thrown by this attempt. Absent when the attempt succeeded.
 * @property timedOut - `true` when this attempt was aborted by the step's `timeout` setting.
 * @property timing   - Wall-clock metrics for this single attempt.
 */
export type AttemptRecord = {
  attempt: number
  error?: Error
  timedOut: boolean
  timing: Timing
}

/**
 * Configures what counts as a successful pipeline run when some steps fail.
 *
 * All specified criteria must pass. Skipped steps are excluded from all counts
 * and rate calculations. If omitted, the default behaviour applies: every
 * non-skipped step must succeed.
 *
 * @property minStepsSuccessful  - Minimum number of non-skipped steps that must succeed.
 * @property maxStepsUnsuccessful - Maximum number of non-skipped steps allowed to fail.
 * @property minSuccessRate      - Minimum ratio (0.0–1.0) of successful to total non-skipped steps.
 */
export type PipelineSuccessCriteria = {
  minStepsSuccessful?: number
  maxStepsUnsuccessful?: number
  minSuccessRate?: number
}

/**
 * Summary of a single step's execution, included in `PipelineResult.steps`.
 *
 * Every step that was visited during a pipeline run — including skipped and
 * failed ones — produces a `StepRecord`.
 *
 * @property name          - Display name of the step.
 * @property skipped       - `true` when `shouldRun` returned `false` and the step was bypassed.
 * @property executeFailed - `true` when `execute` threw (all retries exhausted). `false` when
 *                           execute succeeded (even if checks subsequently failed) or the step
 *                           was skipped. Lets callers distinguish an execute failure from a
 *                           check failure without inspecting `checks`.
 * @property succeeded     - `true` when the step ran, execute succeeded, and all checks passed.
 *                           Always `false` for skipped steps. Used by `PipelineSuccessCriteria`.
 * @property attempts      - One record per execute call made. Empty for skipped steps. A step
 *                           that succeeds on the first try has exactly one record; a step that
 *                           retries has one record per attempt (failed or not).
 * @property checks        - Ordered list of check outcomes. NONE-status records are present for
 *                           skipped steps, for steps whose execute threw, and for checks that
 *                           were not reached after a TERMINAL check.
 * @property timing        - Wall-clock metrics for the entire step (all attempts combined).
 */
export type StepRecord = {
  name: string
  skipped: boolean
  executeFailed: boolean
  succeeded: boolean
  attempts: AttemptRecord[]
  checks: CheckRecord[]
  timing: Timing
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
      /** `true` when `shouldRun` returned `false` — execute and checks did not run. */
      skipped: boolean
      /** Fully enriched data: accumulated input merged with this step's output. */
      data: TOutput
      /** One record per execute attempt. Empty when skipped. */
      attemptRecords: AttemptRecord[]
      /** All check records for this step, in the order they ran. */
      checks: CheckRecord[]
      /** `false` if any check has status FAIL or ERROR. */
      allChecksPassed: boolean
      /** `true` when the step's policy says to halt the pipeline. */
      shouldStop: boolean
      /** `true` when a check returned `terminal: true`, forcing pipeline failure. Always implies `shouldStop`. */
      terminal: boolean
      timing: Timing
    }
  | {
      success: false
      /** The error thrown by `execute` (or the final retry attempt). */
      error: Error
      /** One record per execute attempt. */
      attemptRecords: AttemptRecord[]
      /** `true` when the step's policy says to halt the pipeline. */
      shouldStop: boolean
      /** NONE records for every check configured on this step — execute never ran them. */
      checks: CheckRecord[]
      timing: Timing
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
  | {
      success: true
      data: TData
      steps: StepRecord[]
      timing: Timing
      /** Number of pipeline-level restarts triggered by `retry.restartFromStep`. */
      restarts: number
    }
  | {
      success: false
      data: TData
      /** Describes the first halting failure: a thrown execute error, the first
       *  failing check message, or a criteria-not-met summary. */
      error: Error
      steps: StepRecord[]
      timing: Timing
      /** `true` when a TERMINAL check forced failure, overriding any success criteria. */
      terminated: boolean
      /** Number of pipeline-level restarts triggered by `retry.restartFromStep`. */
      restarts: number
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
 *
 * **Shared reference:** the collector instance is copied by reference to every
 * pipeline derived via `.step()` or `.check()`. Concurrent `execute()` calls on
 * sibling pipelines will interleave events into the same collector. This is fine
 * for serial use; for concurrent use, provide a fresh collector per execution.
 */
export type AnalyticsCollector = {
  /** Fired immediately before a step's first `execute` call. */
  onStepStart: (stepName: string, input: unknown) => void
  /**
   * Fired after each failed execute attempt, before the backoff delay.
   * Not called when the final attempt fails (use `onStepComplete` for that).
   *
   * @param stepName - Display name of the step.
   * @param attempt  - The 1-based attempt number that just failed.
   * @param error    - The error thrown by the attempt.
   * @param delay    - Milliseconds to wait before the next attempt.
   */
  onStepAttempt: (stepName: string, attempt: number, error: Error, delay: number) => void
  /** Fired after `execute` completes (success or final failure) and after all checks run. */
  onStepComplete: (stepName: string, result: StepResult, duration: number) => void
  /** Fired when `shouldRun` returned `false` and the step was bypassed. */
  onStepSkipped: (stepName: string, reason: string) => void
  /**
   * Fired when a `retry.restartFromStep` restarts the pipeline from an earlier step.
   *
   * @param pipelineName  - Name of the pipeline.
   * @param fromStepName  - Name of the step the pipeline is restarting from.
   * @param restartNumber - 1-based restart count (1 = first restart).
   */
  onPipelineRestart: (pipelineName: string, fromStepName: string, restartNumber: number) => void
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
 * ## Retry vs policy interaction
 *
 * `retry` and `policy` address different levels of failure handling:
 *
 * - `retry` controls **how many times execute is attempted** and how long to
 *   wait between attempts. Retries happen entirely within the step — the
 *   pipeline does not advance until all attempts are resolved.
 * - `policy` controls **what happens after all retry attempts are exhausted**:
 *   should the pipeline halt (`STOP`) or continue to the next step (`CONTINUE`)?
 *
 * @template TAccumulated - All data accumulated before this step runs
 * @template TOutput      - The new data shape this step produces
 *
 * @property name      - Display name shown in analytics and `StepRecord`. Defaults to `"Step N"`.
 * @property execute   - The core function. Receives all accumulated data and returns new data
 *                       to merge. May be async. Throwing here triggers `retry` and then `onFailure`.
 * @property shouldRun - Optional guard called before `execute`. Return `false` to skip the step.
 * @property onSuccess - Called after a successful `execute`, before checks run.
 *                       Receives the raw step output and the pre-merge accumulated data.
 * @property onFailure - Called once after the final failed attempt (all retries exhausted).
 *                       Receives the thrown error and the accumulated data at time of failure.
 * @property onRetry   - Called after each failed attempt, before the backoff delay and the next
 *                       attempt. Not called on the last attempt. Receives the error, the 1-based
 *                       attempt number that just failed, the delay in ms, and the accumulated data.
 * @property retry     - Full retry policy: attempt count, backoff, conditions, delay caps, and
 *                       optional pipeline restart target.
 * @property retries   - Shorthand: number of **additional** attempts (0 = no retry, 1 = one retry).
 *                       Ignored when `retry` is also set.
 * @property timeout   - Maximum milliseconds for a single execute attempt. Exceeding it counts
 *                       as a failure and triggers the retry/onFailure path.
 * @property policy    - Controls what happens when all retry attempts are exhausted and the step
 *                       still fails. All fields default to `'STOP'`. Set individual fields to
 *                       `'CONTINUE'` to let the pipeline keep running after that failure mode.
 */
export type StepConfig<TAccumulated, TOutput> = {
  name?: string
  execute: (input: TAccumulated, steps: readonly StepRecord[]) => Promise<TOutput> | TOutput
  shouldRun?: StepCondition<TAccumulated>
  onSuccess?: (output: TOutput, accumulated: TAccumulated) => void | Promise<void>
  onFailure?: (error: Error, input: TAccumulated) => void | Promise<void>
  onRetry?: (
    error: Error,
    attempt: number,
    delay: number,
    input: TAccumulated,
  ) => void | Promise<void>
  retry?: RetryPolicy
  /** @deprecated Use `retry: { maxAttempts: N + 1 }` instead. Ignored when `retry` is set. */
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
  /** Overrides the default "all steps must succeed" verdict. TERMINAL checks always force failure regardless of criteria. */
  successCriteria?: PipelineSuccessCriteria
}
