/**
 * Utility type to merge accumulated data with new step output
 */
export type Enrich<TAccumulated, TNew> = TAccumulated & TNew

/**
 * Represents the execution context passed through the flow
 */
export type StepContext<TData = unknown> = {
  data: TData
  metadata: {
    stepName: string
    startTime: number
    previousSteps: string[]
  }
}

/**
 * Result of a step execution
 */
export type StepResult<TOutput = unknown> =
  | { success: true; data: TOutput; analytics?: Record<string, unknown> }
  | { success: false; error: Error; analytics?: Record<string, unknown> }

/**
 * Condition function that determines if a step should execute
 */
export type StepCondition<TInput = unknown> = (
  context: StepContext<TInput>,
) => boolean | Promise<boolean>

/**
 * Analytics collector for step execution
 */
export type AnalyticsCollector = {
  onStepStart: (stepName: string, input: unknown) => void
  onStepComplete: (stepName: string, result: StepResult, duration: number) => void
  onStepSkipped: (stepName: string, reason: string) => void
  onFlowComplete: (flowName: string, totalDuration: number) => void
  onFlowError: (flowName: string, error: Error) => void
}

/**
 * Configuration for a single step
 */
export type StepConfig<TAccumulated, TOutput> = {
  name?: string
  execute: (input: TAccumulated) => Promise<TOutput> | TOutput
  shouldRun?: StepCondition<TAccumulated>
  onSuccess?: (output: TOutput, accumulated: TAccumulated) => void | Promise<void>
  onFailure?: (error: Error, input: TAccumulated) => void | Promise<void>
  retries?: number
  timeout?: number
}

/**
 * Configuration for a flow
 */
export type FlowConfig = {
  name: string
  analytics?: AnalyticsCollector
  continueOnError?: boolean
}
