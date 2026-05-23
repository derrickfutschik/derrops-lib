import { StepConfig, StepContext, StepResult, Enrich, AnalyticsCollector } from './types'

/**
 * Represents a single step in a flow.
 * Each step receives accumulated data and produces new data that gets merged.
 */
export class Step<TAccumulated, TOutput> {
  constructor(
    private config: StepConfig<TAccumulated, TOutput>,
    private index: number = 0,
  ) {}

  /**
   * Get the name of this step
   */
  get name(): string {
    return this.config.name ?? `Step ${this.index}`
  }

  /**
   * Execute this step with the given context.
   * Returns enriched data (accumulated + new output).
   */
  async execute(
    context: StepContext<TAccumulated>,
    analytics: AnalyticsCollector,
  ): Promise<StepResult<Enrich<TAccumulated, TOutput>>> {
    const name = this.name
    const { execute, shouldRun, onSuccess, onFailure, retries = 0, timeout } = this.config

    // Check if step should run
    if (shouldRun) {
      const should = await shouldRun(context)
      if (!should) {
        analytics.onStepSkipped(name, 'Condition not met')
        // Return accumulated data unchanged when skipped
        return {
          success: true,
          data: context.data as Enrich<TAccumulated, TOutput>,
          analytics: { skipped: true },
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

        // Merge new output with accumulated data
        const enrichedData: Enrich<TAccumulated, TOutput> = {
          ...context.data,
          ...result,
        }

        await onSuccess?.(result, context.data)

        const analyticsData = {
          attempts: attempt + 1,
          duration,
        }

        analytics.onStepComplete(name, { success: true, data: enrichedData }, duration)

        return { success: true, data: enrichedData, analytics: analyticsData }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === retries) {
          const duration = Date.now() - startTime
          await onFailure?.(lastError, context.data)

          analytics.onStepComplete(name, { success: false, error: lastError }, duration)

          return {
            success: false,
            error: lastError,
            analytics: { attempts: attempt + 1, duration },
          }
        }
      }
    }

    throw lastError!
  }

  /**
   * Wrap a promise with a timeout
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
