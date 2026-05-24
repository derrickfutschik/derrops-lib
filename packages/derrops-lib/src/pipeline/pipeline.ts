import { Step } from './step'
import {
  CheckFn,
  PipelineConfig,
  PipelineResult,
  StepConfig,
  StepContext,
  StepRecord,
  Enrich,
  AnalyticsCollector,
} from './types'

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
 * 2. `execute` runs (with optional retries and timeout).
 * 3. If execute succeeds, all attached checks run in order.
 * 4. After all checks, the step's `ContinuePolicy` determines whether the
 *    pipeline halts or continues.
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
    const pipelineStartTime = Date.now()
    let currentData: any = initialInput
    const executedSteps: string[] = []
    const stepRecords: StepRecord[] = []
    let pipelineSuccess = true

    try {
      for (const step of this.steps) {
        const context: StepContext = {
          data: currentData,
          metadata: {
            stepName: step.name,
            startTime: Date.now(),
            previousSteps: [...executedSteps],
          },
        }

        const result = await step.execute(context, this.analytics)
        executedSteps.push(step.name)

        if (!result.success) {
          stepRecords.push({ name: step.name, skipped: false, checks: [] })
          if (result.shouldStop) {
            this.analytics.onPipelineComplete(this.config.name, Date.now() - pipelineStartTime)
            return { success: false, data: currentData, error: result.error, steps: stepRecords }
          }
          pipelineSuccess = false
        } else {
          const skipped = result.analytics?.skipped === true
          stepRecords.push({ name: step.name, skipped, checks: result.checks })

          // Always merge enriched data so subsequent steps and checks see the
          // full context, even when this step's checks failed.
          currentData = result.data

          if (!result.allChecksPassed) {
            pipelineSuccess = false
          }

          if (result.shouldStop) {
            const stoppingCheck = result.checks.find(
              (c) => c.result.status === 'FAIL' || c.result.status === 'ERROR',
            )
            const message =
              stoppingCheck?.result.message ??
              (stoppingCheck?.name ? `Check "${stoppingCheck.name}" failed` : `Check failed`)
            this.analytics.onPipelineComplete(this.config.name, Date.now() - pipelineStartTime)
            return {
              success: false,
              data: currentData,
              error: new Error(message),
              steps: stepRecords,
            }
          }
        }
      }

      const totalDuration = Date.now() - pipelineStartTime
      this.analytics.onPipelineComplete(this.config.name, totalDuration)

      if (pipelineSuccess) {
        return { success: true, data: currentData, steps: stepRecords }
      }

      return {
        success: false,
        data: currentData,
        error: new Error('One or more step checks failed'),
        steps: stepRecords,
      }
    } catch (error) {
      const pipelineError = error instanceof Error ? error : new Error(String(error))
      this.analytics.onPipelineError(this.config.name, pipelineError)
      return { success: false, data: currentData, error: pipelineError, steps: stepRecords }
    }
  }

  /** Default no-op analytics — silent unless the caller provides a collector. */
  private createDefaultAnalytics(): AnalyticsCollector {
    return {
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepSkipped: () => {},
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
