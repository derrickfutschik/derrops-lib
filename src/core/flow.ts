import { Step } from './step'
import {
  FlowConfig,
  StepConfig,
  StepContext,
  StepResult,
  Enrich,
  AnalyticsCollector,
} from './types'

/**
 * A sequential flow that enriches data as it passes through each step.
 * Each step receives all accumulated data and adds its output to it.
 *
 * @template TAccumulated - The accumulated data type from all previous steps
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
   * Add a step that enriches the accumulated data.
   * The step receives all data from previous steps and its output is merged in.
   *
   * @template TOutput - The new data this step produces
   * @returns A new flow with the enriched type
   */
  step<TOutput>(
    stepConfig: StepConfig<TAccumulated, TOutput>,
  ): SequentialFlow<TInitial, Enrich<TAccumulated, TOutput>> {
    const newFlow = new SequentialFlow<TInitial, Enrich<TAccumulated, TOutput>>(this.config)
    newFlow.steps = [...this.steps, new Step(stepConfig, this.steps.length)]
    newFlow.analytics = this.analytics
    return newFlow
  }

  /**
   * Execute the entire flow with the given initial input.
   * Returns the fully accumulated data from all steps.
   */
  async execute(initialInput: TInitial): Promise<StepResult<TAccumulated>> {
    const flowStartTime = Date.now()
    let currentData: any = initialInput
    const executedSteps: string[] = []

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
          if (!this.config.continueOnError) {
            return result
          }
        } else {
          currentData = result.data
        }

        executedSteps.push(step.name)
      }

      const totalDuration = Date.now() - flowStartTime
      this.analytics.onFlowComplete(this.config.name, totalDuration)

      return { success: true, data: currentData }
    } catch (error) {
      const flowError = error instanceof Error ? error : new Error(String(error))
      this.analytics.onFlowError(this.config.name, flowError)
      return { success: false, error: flowError }
    }
  }

  /**
   * Create default console-based analytics
   */
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
 * Create a new sequential flow with optional initial data type.
 *
 * @example
 * ```typescript
 * const flow = createFlow<{ projectName: string }>({ name: 'Build' })
 *   .addStep({ name: 'Lint', execute: (data) => ({ errors: 0 }) })
 *   .addStep({ name: 'Compile', execute: (data) => ({ files: ['index.js'] }) });
 *
 * const result = await flow.execute({ projectName: 'my-app' });
 * // result.data has: projectName, errors, files
 * ```
 */
export function createFlow<TInitial = {}>(config: FlowConfig): SequentialFlow<TInitial> {
  return new SequentialFlow<TInitial>(config)
}
