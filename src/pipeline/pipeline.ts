import { Step } from './step'
import {
  CheckFn,
  PipelineConfig,
  PipelineResult,
  PipelineSuccessCriteria,
  StepConfig,
  StepContext,
  StepRecord,
  Enrich,
  AnalyticsCollector,
} from './types'

function evaluatePipeline(
  criteria: PipelineSuccessCriteria | undefined,
  stepRecords: StepRecord[],
): { succeeded: boolean; error?: Error } {
  const ran = stepRecords.filter((r) => !r.skipped)

  // No criteria: vacuously succeed when nothing ran, otherwise require all ran steps to succeed.
  if (!criteria) {
    if (ran.length === 0) return { succeeded: true }
    const failCount = ran.filter((r) => !r.succeeded).length
    if (failCount === 0) return { succeeded: true }
    return {
      succeeded: false,
      error: new Error(`${failCount} step${failCount !== 1 ? 's' : ''} failed`),
    }
  }

  const successCount = ran.filter((r) => r.succeeded).length
  const failCount = ran.length - successCount

  const violations: string[] = []
  if (criteria.minStepsSuccessful !== undefined && successCount < criteria.minStepsSuccessful)
    violations.push(
      `${successCount} of ${ran.length} steps succeeded (minimum ${criteria.minStepsSuccessful} required)`,
    )
  if (criteria.maxStepsUnsuccessful !== undefined && failCount > criteria.maxStepsUnsuccessful)
    violations.push(`${failCount} steps failed (maximum ${criteria.maxStepsUnsuccessful} allowed)`)
  if (criteria.minSuccessRate !== undefined && ran.length > 0) {
    const rate = successCount / ran.length
    if (rate < criteria.minSuccessRate)
      violations.push(
        `${Math.round(rate * 100)}% of steps succeeded (minimum ${Math.round(criteria.minSuccessRate * 100)}% required)`,
      )
  }

  if (violations.length === 0) return { succeeded: true }
  return { succeeded: false, error: new Error(violations.join('; ')) }
}

function validateCriteria(criteria: PipelineSuccessCriteria): void {
  if (criteria.minStepsSuccessful !== undefined && criteria.minStepsSuccessful < 0)
    throw new Error('successCriteria.minStepsSuccessful must be >= 0')
  if (criteria.maxStepsUnsuccessful !== undefined && criteria.maxStepsUnsuccessful < 0)
    throw new Error('successCriteria.maxStepsUnsuccessful must be >= 0')
  if (
    criteria.minSuccessRate !== undefined &&
    (criteria.minSuccessRate < 0 || criteria.minSuccessRate > 1)
  )
    throw new Error('successCriteria.minSuccessRate must be between 0 and 1 inclusive')
}

/**
 * A sequential, type-safe pipeline that enriches a shared data object as execution
 * passes through each step.
 *
 * Each call to `.step()` widens the `TAccumulated` type parameter so that every
 * subsequent step and check has full type-safe access to all data produced so
 * far. The pipeline is immutable — `.step()` and `.check()` always return a new
 * instance rather than modifying the existing one.
 *
 * ### Execution model
 *
 * Steps run in the order they were added. For each step:
 * 1. `shouldRun` is evaluated — if `false`, the step is skipped and all its
 *    checks are recorded as `NONE`.
 * 2. `execute` runs, with the step's `RetryPolicy` (if any) controlling how many
 *    attempts are made and how long to wait between them.
 * 3. If execute succeeds, all attached checks run in order.
 * 4. After all checks, the step's `ContinuePolicy` determines whether the
 *    pipeline halts or continues. If the step has `retry.restartFromStep` and
 *    `ContinuePolicy` would halt, the pipeline rewinds to the named step instead.
 *
 * `data` is always present in `PipelineResult`, even when `success` is `false`,
 * so callers can inspect the full enriched context for logging and diagnostics.
 *
 * @template TInitial     - The shape of the value passed to `execute()`
 * @template TAccumulated - The accumulated data type after all steps added so far
 *
 * @example
 * ```typescript
 * const result = await createPipeline<{ userId: string }>({ name: 'Onboarding' })
 *   .step({ name: 'Fetch User', execute: async (ctx) => ({ userName: 'Alice' }) })
 *   .check('User active', (ctx) => ({ success: ctx.userName !== '' }))
 *   .step({ name: 'Send Welcome', execute: async (ctx) => ({ sent: true }) })
 *   .execute({ userId: 'u-1' })
 * ```
 */
export class SequentialPipeline<TInitial, TAccumulated = TInitial> {
  private steps: Array<Step<any, any>> = []
  private analytics: AnalyticsCollector
  private config: PipelineConfig

  constructor(config: PipelineConfig) {
    this.config = config
    this.analytics = config.analytics || this.createDefaultAnalytics()
  }

  /**
   * Appends a step that enriches the accumulated data.
   *
   * The step's `execute` function receives the full accumulated data object
   * (initial input merged with all previous step outputs) and must return a new
   * object whose fields are merged into the accumulation. Returning a key that
   * already exists will shadow the earlier value in subsequent steps.
   *
   * Accepts either a full `StepConfig` object or a bare execute function as a
   * shorthand (equivalent to `{ execute: fn }`).
   *
   * @template TOutput - The new fields this step adds to the accumulated data
   *
   * @example
   * // Config object form
   * .step({ name: 'Fetch', execute: async (ctx) => ({ user: await db.find(ctx.userId) }) })
   *
   * // Bare function shorthand
   * .step(async (ctx) => ({ user: await db.find(ctx.userId) }))
   */
  step<TOutput>(
    stepConfig:
      | StepConfig<TAccumulated, TOutput>
      | ((input: TAccumulated) => Promise<TOutput> | TOutput),
  ): SequentialPipeline<TInitial, Enrich<TAccumulated, TOutput>> {
    const config: StepConfig<TAccumulated, TOutput> =
      typeof stepConfig === 'function' ? { execute: stepConfig } : stepConfig
    const newPipeline = new SequentialPipeline<TInitial, Enrich<TAccumulated, TOutput>>(this.config)
    newPipeline.steps = [...this.steps, new Step(config, this.steps.length)]
    newPipeline.analytics = this.analytics
    return newPipeline
  }

  /**
   * Attaches a check to the most recently added step.
   *
   * Multiple `.check()` calls chain onto the same step and execute in order
   * after that step's `execute` succeeds. The check function receives the
   * fully enriched data object (accumulated input + this step's output) as
   * its single argument.
   *
   * All checks on a step always run to completion before the pipeline evaluates
   * whether to halt — the pipeline never stops mid-step.
   *
   * Whether a failing check stops the pipeline is controlled by the step's
   * `policy.failure` setting, not by the check return value.
   *
   * @throws {Error} If called before any `.step()` has been added.
   *
   * @example
   * // Anonymous check
   * .check((ctx) => ({ success: ctx.score > 0 }))
   *
   * // Named check — name appears in CheckRecord for easier log inspection
   * .check('Score positive', (ctx) => ({ success: ctx.score > 0 }))
   */
  check(fn: CheckFn<TAccumulated>): SequentialPipeline<TInitial, TAccumulated>
  check(name: string, fn: CheckFn<TAccumulated>): SequentialPipeline<TInitial, TAccumulated>
  check(
    nameOrFn: string | CheckFn<TAccumulated>,
    maybeFn?: CheckFn<TAccumulated>,
  ): SequentialPipeline<TInitial, TAccumulated> {
    if (this.steps.length === 0) throw new Error('No step to attach a check to')
    const name = typeof nameOrFn === 'string' ? nameOrFn : undefined
    const fn = typeof nameOrFn === 'function' ? nameOrFn : maybeFn!
    const newPipeline = new SequentialPipeline<TInitial, TAccumulated>(this.config)
    const steps = [...this.steps]
    steps[steps.length - 1] = steps[steps.length - 1].withCheck(name, fn)
    newPipeline.steps = steps
    newPipeline.analytics = this.analytics
    return newPipeline
  }

  /**
   * Runs all steps in order and returns a `PipelineResult`.
   *
   * `data` is always populated in the result — even on failure — so callers
   * can always read the enriched context. Narrow on `result.success` to access
   * `result.error` in the failure branch.
   *
   * The overall pipeline `success` is `true` only when every step's `execute`
   * succeeded and every check returned `PASS`. A single `FAIL` or `ERROR`
   * check anywhere in the pipeline sets `success` to `false`, even if all
   * subsequent steps ran and passed.
   *
   * @param initialInput - The starting value passed as `data` to the first step.
   */
  async execute(initialInput: TInitial): Promise<PipelineResult<TAccumulated>> {
    const pipelineStartedAt = Date.now()
    let currentData: any = initialInput
    const stepRecords: StepRecord[] = []
    const criteria = this.config.successCriteria

    if (criteria) validateCriteria(criteria)
    this.validateRestartTargets()
    for (const step of this.steps) step.validateRetry()

    const pipelineTiming = () => {
      const finishedAt = Date.now()
      return { startedAt: pipelineStartedAt, finishedAt, duration: finishedAt - pipelineStartedAt }
    }

    // Snapshot of currentData before each step runs, used to restore state on restart.
    const dataSnapshots: unknown[] = []
    // How many times each step index has been used as a restart target.
    const restartCounts = new Map<number, number>()
    let totalRestarts = 0

    try {
      let stepIndex = 0
      while (stepIndex < this.steps.length) {
        const step = this.steps[stepIndex]

        // Save the data state before this step so we can restore it on restart.
        dataSnapshots[stepIndex] = currentData

        const context: StepContext = {
          data: currentData,
          metadata: {
            stepName: step.name,
            previousSteps: stepRecords.map((r) => r.name),
          },
        }

        const result = await step.execute(context, this.analytics, [...stepRecords])

        if (!result.success) {
          stepRecords.push({
            name: step.name,
            skipped: false,
            executeFailed: true,
            succeeded: false,
            attempts: result.attemptRecords,
            checks: result.checks,
            timing: result.timing,
          })

          if (result.shouldStop) {
            // Check whether this step wants to restart the pipeline from an earlier step.
            const restartIdx = this.resolveRestartTarget(step)
            if (restartIdx !== undefined) {
              const priorCount = restartCounts.get(restartIdx) ?? 0
              if (priorCount < step.maxRestarts) {
                restartCounts.set(restartIdx, priorCount + 1)
                totalRestarts++
                const fromStep = this.steps[restartIdx]
                this.analytics.onPipelineRestart(this.config.name, fromStep.name, totalRestarts)
                // Restore state and rewind.
                currentData = dataSnapshots[restartIdx]
                stepRecords.splice(restartIdx)
                stepIndex = restartIdx
                continue
              }
              // maxRestarts exceeded — fall through to normal stop.
            }

            const timing = pipelineTiming()
            this.analytics.onPipelineComplete(this.config.name, timing.duration)
            const verdict = evaluatePipeline(criteria, stepRecords)
            if (verdict.succeeded) {
              return {
                success: true,
                data: currentData,
                steps: stepRecords,
                timing,
                restarts: totalRestarts,
              }
            }
            return {
              success: false,
              data: currentData,
              error: result.error,
              steps: stepRecords,
              timing,
              terminated: false,
              restarts: totalRestarts,
            }
          }
        } else {
          const skipped = result.skipped
          const succeeded = !skipped && result.allChecksPassed
          stepRecords.push({
            name: step.name,
            skipped,
            executeFailed: false,
            succeeded,
            attempts: result.attemptRecords,
            checks: result.checks,
            timing: result.timing,
          })

          // Always merge enriched data so subsequent steps and checks see the
          // full context, even when this step's checks failed.
          currentData = result.data

          if (result.terminal) {
            const terminalCheck = result.checks.find((c) => c.result.status === 'TERMINAL')
            const message =
              terminalCheck?.result.message ??
              (terminalCheck?.name
                ? `Check "${terminalCheck.name}" terminated the pipeline`
                : 'A terminal check stopped the pipeline')
            const timing = pipelineTiming()
            this.analytics.onPipelineComplete(this.config.name, timing.duration)
            return {
              success: false,
              data: currentData,
              error: new Error(message),
              steps: stepRecords,
              timing,
              terminated: true,
              restarts: totalRestarts,
            }
          }

          if (result.shouldStop) {
            const stoppingCheck = result.checks.find(
              (c) => c.result.status === 'FAIL' || c.result.status === 'ERROR',
            )
            const message =
              stoppingCheck?.result.message ??
              (stoppingCheck?.name ? `Check "${stoppingCheck.name}" failed` : `Check failed`)
            const timing = pipelineTiming()
            this.analytics.onPipelineComplete(this.config.name, timing.duration)
            const verdict = evaluatePipeline(criteria, stepRecords)
            if (verdict.succeeded) {
              return {
                success: true,
                data: currentData,
                steps: stepRecords,
                timing,
                restarts: totalRestarts,
              }
            }
            return {
              success: false,
              data: currentData,
              error: new Error(message),
              steps: stepRecords,
              timing,
              terminated: false,
              restarts: totalRestarts,
            }
          }
        }

        stepIndex++
      }

      const timing = pipelineTiming()
      this.analytics.onPipelineComplete(this.config.name, timing.duration)

      const verdict = evaluatePipeline(criteria, stepRecords)
      if (verdict.succeeded) {
        return {
          success: true,
          data: currentData,
          steps: stepRecords,
          timing,
          restarts: totalRestarts,
        }
      }
      return {
        success: false,
        data: currentData,
        error: verdict.error!,
        steps: stepRecords,
        timing,
        terminated: false,
        restarts: totalRestarts,
      }
    } catch (error) {
      const pipelineError = error instanceof Error ? error : new Error(String(error))
      this.analytics.onPipelineError(this.config.name, pipelineError)
      return {
        success: false,
        data: currentData,
        error: pipelineError,
        steps: stepRecords,
        timing: pipelineTiming(),
        terminated: false,
        restarts: totalRestarts,
      }
    }
  }

  /**
   * Validates that all `retry.restartFromStep` references point to steps that
   * exist and are earlier than the step that configures them.
   *
   * Called once at the start of `execute()` so misconfigurations fail loudly
   * before any work is done.
   */
  private validateRestartTargets(): void {
    for (let i = 0; i < this.steps.length; i++) {
      const target = this.steps[i].retryRestartTarget
      if (target === undefined) continue

      const targetIdx =
        typeof target === 'number' ? target : this.steps.findIndex((s) => s.name === target)

      if (typeof target === 'string' && targetIdx === -1) {
        throw new Error(
          `Step "${this.steps[i].name}": retry.restartFromStep "${target}" does not match any step name`,
        )
      }
      if (typeof target === 'number' && (targetIdx < 0 || targetIdx >= this.steps.length)) {
        throw new Error(
          `Step "${this.steps[i].name}": retry.restartFromStep index ${target} is out of range`,
        )
      }
      if (targetIdx >= i) {
        throw new Error(
          `Step "${this.steps[i].name}": retry.restartFromStep must point to an earlier step (target index ${targetIdx} >= current index ${i})`,
        )
      }
    }
  }

  /**
   * Resolves a step's `restartFromStep` to a step index, or returns `undefined`
   * if no restart is configured.
   */
  private resolveRestartTarget(step: Step<any, any>): number | undefined {
    const target = step.retryRestartTarget
    if (target === undefined) return undefined
    if (typeof target === 'number') return target
    const idx = this.steps.findIndex((s) => s.name === target)
    return idx === -1 ? undefined : idx
  }

  /** Default no-op analytics — silent unless the caller provides a collector. */
  private createDefaultAnalytics(): AnalyticsCollector {
    return {
      onStepStart: () => {},
      onStepAttempt: () => {},
      onStepComplete: () => {},
      onStepSkipped: () => {},
      onPipelineRestart: () => {},
      onPipelineComplete: () => {},
      onPipelineError: () => {},
    }
  }
}

/**
 * Creates a new `SequentialPipeline` with the given configuration.
 *
 * The generic type parameter `TInitial` defines the shape of the value passed
 * to `pipeline.execute()`. Subsequent `.step()` calls widen the accumulated type
 * automatically via inference.
 *
 * @param config - Pipeline name and optional analytics collector.
 *
 * @example
 * ```typescript
 * const pipeline = createPipeline<{ projectName: string }>({ name: 'Build Pipeline' })
 *   .step({ name: 'Lint', execute: async (ctx) => ({ lintErrors: 0 }) })
 *   .check('No lint errors', (ctx) => ({ success: ctx.lintErrors === 0 }))
 *   .step({ name: 'Compile', execute: async (ctx) => ({ compiledFiles: ['index.js'] }) })
 *
 * const result = await pipeline.execute({ projectName: 'my-app' })
 * // result.data → { projectName, lintErrors, compiledFiles }
 * ```
 */
export function createPipeline<TInitial = {}>(
  config: PipelineConfig,
): SequentialPipeline<TInitial> {
  return new SequentialPipeline<TInitial>(config)
}
