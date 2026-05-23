import { Step } from './step'
import {
  CheckFn,
  FlowConfig,
  FlowResult,
  StepConfig,
  StepContext,
  StepRecord,
  Enrich,
  AnalyticsCollector,
} from './types'

/**
 * A sequential, type-safe flow that enriches a shared data object as execution
 * passes through each step.
 *
 * Each call to `.step()` widens the `TAccumulated` type parameter so that every
 * subsequent step and check has full type-safe access to all data produced so
 * far. The flow is immutable — `.step()` and `.check()` always return a new
 * instance rather than modifying the existing one.
 *
 * ### Execution model
 *
 * Steps run in the order they were added. For each step:
 * 1. `shouldRun` is evaluated — if `false`, the step is skipped and all its
 *    checks are recorded as `NONE`.
 * 2. `execute` runs (with optional retries and timeout).
 * 3. If execute succeeds, all attached checks run in order.
 * 4. If any check sets `shouldStop`, the flow halts after finishing the
 *    remaining checks on that step — subsequent steps do not run.
 *
 * `data` is always present in `FlowResult`, even when `success` is `false`,
 * so callers can inspect the full enriched context for logging and diagnostics.
 *
 * @template TInitial     - The shape of the value passed to `execute()`
 * @template TAccumulated - The accumulated data type after all steps added so far
 *
 * @example
 * ```typescript
 * const result = await createFlow<{ userId: string }>({ name: 'Onboarding' })
 *   .step({ name: 'Fetch User', execute: async (ctx) => ({ userName: 'Alice' }) })
 *   .check('User active', (ctx) => ({ success: ctx.userName !== '', continue: false }))
 *   .step({ name: 'Send Welcome', execute: async (ctx) => ({ sent: true }) })
 *   .execute({ userId: 'u-1' })
 * ```
 */
export class SequentialFlow<TInitial, TAccumulated = TInitial> {
  private steps: Array<Step<any, any>> = []
  private analytics: AnalyticsCollector
  private config: FlowConfig

  constructor(config: FlowConfig) {
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
  ): SequentialFlow<TInitial, Enrich<TAccumulated, TOutput>> {
    const config: StepConfig<TAccumulated, TOutput> =
      typeof stepConfig === 'function' ? { execute: stepConfig } : stepConfig
    const newFlow = new SequentialFlow<TInitial, Enrich<TAccumulated, TOutput>>(this.config)
    newFlow.steps = [...this.steps, new Step(config, this.steps.length)]
    newFlow.analytics = this.analytics
    return newFlow
  }

  /**
   * Attaches a check to the most recently added step.
   *
   * Multiple `.check()` calls chain onto the same step and execute in order
   * after that step's `execute` succeeds. The check function receives the
   * fully enriched data object (accumulated input + this step's output) as
   * its single argument.
   *
   * All checks on a step always run to completion, even when an earlier check
   * returns `continue: false`. The pipeline halts *after* all checks on the
   * step have been recorded — never mid-step.
   *
   * **Returning `{ success: false, continue: true }`** marks the overall flow
   * as failed but lets subsequent steps keep running. Use this to gather as
   * much diagnostic context as possible before a final denial decision.
   *
   * **Returning `{ success: false, continue: false }`** also marks the flow as
   * failed and stops the pipeline before the next step begins.
   *
   * @throws {Error} If called before any `.step()` has been added.
   *
   * @example
   * // Anonymous check
   * .check((ctx) => ({ success: ctx.score > 0, continue: true }))
   *
   * // Named check — name appears in CheckRecord for easier log inspection
   * .check('Score positive', (ctx) => ({ success: ctx.score > 0, continue: true }))
   */
  check(fn: CheckFn<TAccumulated>): SequentialFlow<TInitial, TAccumulated>
  check(name: string, fn: CheckFn<TAccumulated>): SequentialFlow<TInitial, TAccumulated>
  check(
    nameOrFn: string | CheckFn<TAccumulated>,
    maybeFn?: CheckFn<TAccumulated>,
  ): SequentialFlow<TInitial, TAccumulated> {
    if (this.steps.length === 0) throw new Error('No step to attach a check to')
    const name = typeof nameOrFn === 'string' ? nameOrFn : undefined
    const fn = typeof nameOrFn === 'function' ? nameOrFn : maybeFn!
    const newFlow = new SequentialFlow<TInitial, TAccumulated>(this.config)
    const steps = [...this.steps]
    steps[steps.length - 1] = steps[steps.length - 1].withCheck(name, fn)
    newFlow.steps = steps
    newFlow.analytics = this.analytics
    return newFlow
  }

  /**
   * Runs all steps in order and returns a `FlowResult`.
   *
   * `data` is always populated in the result — even on failure — so callers
   * can always read the enriched context. Narrow on `result.success` to access
   * `result.error` in the failure branch.
   *
   * The overall flow `success` is `true` only when every step's `execute`
   * succeeded and every check returned `PASS`. A single `FAIL` or `ERROR`
   * check anywhere in the flow sets `success` to `false`, even if all
   * subsequent steps ran and passed.
   *
   * @param initialInput - The starting value passed as `data` to the first step.
   */
  async execute(initialInput: TInitial): Promise<FlowResult<TAccumulated>> {
    const flowStartTime = Date.now()
    let currentData: any = initialInput
    const executedSteps: string[] = []
    const stepRecords: StepRecord[] = []
    let flowSuccess = true

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

        if (!result.success) {
          // execute threw — stop unless the flow was configured to continue on errors
          stepRecords.push({ name: step.name, skipped: false, checks: [] })
          if (!this.config.continueOnError) {
            return { success: false, data: currentData, error: result.error, steps: stepRecords }
          }
          flowSuccess = false
        } else {
          const skipped = result.analytics?.skipped === true
          stepRecords.push({ name: step.name, skipped, checks: result.checks })

          // Always merge enriched data so subsequent steps and checks see the
          // full context, even when this step's checks failed.
          currentData = result.data

          if (!result.allChecksPassed) {
            flowSuccess = false
          }

          if (result.shouldStop) {
            // Use the message from the first blocking check as the error description
            const blockingCheck = result.checks.find(
              (c) =>
                (c.result.status === 'FAIL' || c.result.status === 'ERROR') && !c.result.continue,
            )
            const message =
              blockingCheck?.result.message ??
              (blockingCheck?.name ? `Check "${blockingCheck.name}" failed` : `Check failed`)
            return {
              success: false,
              data: currentData,
              error: new Error(message),
              steps: stepRecords,
            }
          }

          executedSteps.push(step.name)
        }
      }

      const totalDuration = Date.now() - flowStartTime
      this.analytics.onFlowComplete(this.config.name, totalDuration)

      if (flowSuccess) {
        return { success: true, data: currentData, steps: stepRecords }
      }

      return {
        success: false,
        data: currentData,
        error: new Error('One or more step checks failed'),
        steps: stepRecords,
      }
    } catch (error) {
      const flowError = error instanceof Error ? error : new Error(String(error))
      this.analytics.onFlowError(this.config.name, flowError)
      return { success: false, data: currentData, error: flowError, steps: stepRecords }
    }
  }

  /** Default analytics implementation that logs to the console. */
  private createDefaultAnalytics(): AnalyticsCollector {
    return {
      onStepStart: (name) => console.log(`[${name}] Starting...`),
      onStepComplete: (name, result, duration) =>
        console.log(`[${name}] Completed in ${duration}ms - Success: ${result.success}`),
      onStepSkipped: (name, reason) => console.log(`[${name}] Skipped - ${reason}`),
      onFlowComplete: (name, duration) => console.log(`[Flow: ${name}] Completed in ${duration}ms`),
      onFlowError: (name, error) => console.error(`[Flow: ${name}] Failed:`, error),
    }
  }
}

/**
 * Creates a new `SequentialFlow` with the given configuration.
 *
 * The generic type parameter `TInitial` defines the shape of the value passed
 * to `flow.execute()`. Subsequent `.step()` calls widen the accumulated type
 * automatically via inference.
 *
 * @param config - Flow name, optional analytics collector, and error-continuation flag.
 *
 * @example
 * ```typescript
 * const flow = createFlow<{ projectName: string }>({ name: 'Build Pipeline' })
 *   .step({ name: 'Lint', execute: async (ctx) => ({ lintErrors: 0 }) })
 *   .check('No lint errors', (ctx) => ({ success: ctx.lintErrors === 0, continue: false }))
 *   .step({ name: 'Compile', execute: async (ctx) => ({ compiledFiles: ['index.js'] }) })
 *
 * const result = await flow.execute({ projectName: 'my-app' })
 * // result.data → { projectName, lintErrors, compiledFiles }
 * ```
 */
export function createFlow<TInitial = {}>(config: FlowConfig): SequentialFlow<TInitial> {
  return new SequentialFlow<TInitial>(config)
}
