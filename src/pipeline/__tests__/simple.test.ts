import { describe, it, expect, jest } from '@jest/globals'
import { createPipeline } from '../index'

type UserInput = { userId: string }
type UserData = { userName: string; email: string }
type Preferences = { theme: 'light' | 'dark'; language: string }
type WelcomeMessage = { message: string }

function buildUserOnboardingFlow() {
  return createPipeline<UserInput>({ name: 'User Onboarding' })
    .step<UserData>({
      name: 'Fetch User',
      execute: async (_input) => ({ userName: 'Alice', email: 'alice@example.com' }),
    })
    .step<Preferences>({
      name: 'Load Preferences',
      execute: async (_input) => ({ theme: 'dark', language: 'en' }),
    })
    .step<WelcomeMessage>({
      name: 'Generate Welcome',
      execute: async (input) => ({
        message: `Welcome back, ${input.userName}! Your ${input.theme} theme is ready.`,
      }),
    })
}

describe('simple user onboarding pipeline', () => {
  it('executes successfully', async () => {
    const pipeline = buildUserOnboardingFlow()
    const result = await pipeline.execute({ userId: 'user-123' })
    expect(result.success).toBe(true)
  })

  it('accumulates all fields from every step', async () => {
    const pipeline = buildUserOnboardingFlow()
    const result = await pipeline.execute({ userId: 'user-123' })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.userId).toBe('user-123')
    expect(result.data.userName).toBe('Alice')
    expect(result.data.email).toBe('alice@example.com')
    expect(result.data.theme).toBe('dark')
    expect(result.data.language).toBe('en')
    expect(result.data.message).toBe('Welcome back, Alice! Your dark theme is ready.')
  })

  it('generates the welcome message from accumulated data', async () => {
    const pipeline = createPipeline<UserInput>({ name: 'Welcome Test' })
      .step<UserData>({
        name: 'Fetch User',
        execute: async (_input) => ({ userName: 'Bob', email: 'bob@example.com' }),
      })
      .step<Preferences>({
        name: 'Load Preferences',
        execute: async (_input) => ({ theme: 'light', language: 'fr' }),
      })
      .step<WelcomeMessage>({
        name: 'Generate Welcome',
        execute: async (input) => ({
          message: `Welcome back, ${input.userName}! Your ${input.theme} theme is ready.`,
        }),
      })

    const result = await pipeline.execute({ userId: 'user-456' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.message).toBe('Welcome back, Bob! Your light theme is ready.')
  })

  it('returns failure when a step throws', async () => {
    const pipeline = createPipeline<UserInput>({ name: 'Failing Pipeline' }).step<UserData>({
      name: 'Fetch User',
      execute: async () => {
        throw new Error('Network error')
      },
    })

    const result = await pipeline.execute({ userId: 'user-999' })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toBe('Network error')
  })

  it('uses default step names (Step 0, Step 1, ...) when name is omitted', async () => {
    const onStepStart = jest.fn()

    const pipeline = createPipeline<UserInput>({
      name: 'Default Names Test',
      analytics: {
        onStepStart,
        onStepAttempt: jest.fn(),
        onStepComplete: jest.fn(),
        onStepSkipped: jest.fn(),
        onPipelineRestart: jest.fn(),
        onPipelineComplete: jest.fn(),
        onPipelineError: jest.fn(),
      },
    })
      .step<UserData>({
        execute: async (_input) => ({ userName: 'Alice', email: 'alice@example.com' }),
      })
      .step<Preferences>({
        execute: async (_input) => ({ theme: 'dark', language: 'en' }),
      })
      .step<WelcomeMessage>({
        execute: async (input) => ({ message: `Welcome, ${input.userName}!` }),
      })

    await pipeline.execute({ userId: 'user-123' })

    expect(onStepStart).toHaveBeenNthCalledWith(1, 'Step 0', expect.anything())
    expect(onStepStart).toHaveBeenNthCalledWith(2, 'Step 1', expect.anything())
    expect(onStepStart).toHaveBeenNthCalledWith(3, 'Step 2', expect.anything())
  })

  it('accepts sync step functions (no async)', async () => {
    const pipeline = createPipeline<UserInput>({ name: 'Sync Test' })
      .step((_input) => ({ userName: 'Alice', email: 'alice@example.com' }))
      .step((_input) => ({ theme: 'dark' as const, language: 'en' }))
      .step((input) => ({
        message: `Welcome back, ${input.userName}! Your ${input.theme} theme is ready.`,
      }))

    const result = await pipeline.execute({ userId: 'user-123' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.userName).toBe('Alice')
    expect(result.data.message).toBe('Welcome back, Alice! Your dark theme is ready.')
  })

  it('nested accepts sync step functions (no async)', async () => {
    const pipeline = createPipeline<UserInput>({ name: 'Sync Test' })
      .step((_input) => ({ details: { userName: 'Alice', email: 'alice@example.com' } }))
      .step((_input) => ({ preferences: { theme: 'dark' as const, language: 'en' } }))
      .step((input) => ({
        message: `Welcome back, ${input.details.userName}! Your ${input.preferences.theme} theme is ready.`,
      }))

    const result = await pipeline.execute({ userId: 'user-123' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.details.userName).toBe('Alice')
    expect(result.data.message).toBe('Welcome back, Alice! Your dark theme is ready.')
  })

  it('accepts sync steps in config form (no async)', async () => {
    const pipeline = createPipeline<UserInput>({ name: 'Sync Config Test' })
      .step({
        name: 'Fetch User',
        execute: (_input) => ({ userName: 'Bob', email: 'bob@example.com' }),
      })
      .step({ name: 'Load Preferences', execute: (_input) => ({ theme: 'light' as const }) })

    const result = await pipeline.execute({ userId: 'user-456' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.userName).toBe('Bob')
    expect(result.data.theme).toBe('light')
  })

  it('accepts a bare function as a step shorthand', async () => {
    const pipeline = createPipeline<UserInput>({ name: 'Shorthand Test' })
      .step(async (_input) => ({ userName: 'Alice', email: 'alice@example.com' }))
      .step(async (_input) => ({ theme: 'dark' as const, language: 'en' }))
      .step(async (input) => ({
        message: `Welcome back, ${input.userName}! Your ${input.theme} theme is ready.`,
      }))

    const result = await pipeline.execute({ userId: 'user-123' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.userName).toBe('Alice')
    expect(result.data.theme).toBe('dark')
    expect(result.data.message).toBe('Welcome back, Alice! Your dark theme is ready.')
  })

  it('infers step output types without explicit type parameters', async () => {
    const pipeline = createPipeline<UserInput>({ name: 'Inferred Types Test' })
      .step({
        name: 'Fetch User',
        execute: async (_input) => ({ userName: 'Alice', email: 'alice@example.com' }),
      })
      .step({
        name: 'Load Preferences',
        execute: async (_input) => ({ theme: 'dark' as const, language: 'en' }),
      })
      .step({
        name: 'Generate Welcome',
        execute: async (input) => ({
          message: `Welcome back, ${input.userName}! Your ${input.theme} theme is ready.`,
        }),
      })

    const result = await pipeline.execute({ userId: 'user-123' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.userName).toBe('Alice')
    expect(result.data.theme).toBe('dark')
    expect(result.data.message).toBe('Welcome back, Alice! Your dark theme is ready.')
  })

  it('calls analytics hooks during execution', async () => {
    const onStepStart = jest.fn()
    const onStepComplete = jest.fn()
    const onPipelineComplete = jest.fn()

    const pipeline = createPipeline<UserInput>({
      name: 'Analytics Test',
      analytics: {
        onStepStart,
        onStepAttempt: jest.fn(),
        onStepComplete,
        onStepSkipped: jest.fn(),
        onPipelineRestart: jest.fn(),
        onPipelineComplete,
        onPipelineError: jest.fn(),
      },
    }).step<UserData>({
      name: 'Fetch User',
      execute: async (_input) => ({ userName: 'Alice', email: 'alice@example.com' }),
    })

    await pipeline.execute({ userId: 'user-123' })

    expect(onStepStart).toHaveBeenCalledWith(
      'Fetch User',
      expect.objectContaining({ userId: 'user-123' }),
    )
    expect(onStepComplete).toHaveBeenCalledWith(
      'Fetch User',
      expect.objectContaining({ success: true }),
      expect.any(Number),
    )
    expect(onPipelineComplete).toHaveBeenCalledWith('Analytics Test', expect.any(Number))
  })
})
