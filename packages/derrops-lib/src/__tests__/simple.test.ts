import { describe, it, expect, jest } from '@jest/globals'
import { createFlow } from '../index'

type UserInput = { userId: string }
type UserData = { userName: string; email: string }
type Preferences = { theme: 'light' | 'dark'; language: string }
type WelcomeMessage = { message: string }

function buildUserOnboardingFlow() {
  return createFlow<UserInput>({ name: 'User Onboarding' })
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

describe('simple user onboarding flow', () => {
  it('executes successfully', async () => {
    const flow = buildUserOnboardingFlow()
    const result = await flow.execute({ userId: 'user-123' })
    expect(result.success).toBe(true)
  })

  it('accumulates all fields from every step', async () => {
    const flow = buildUserOnboardingFlow()
    const result = await flow.execute({ userId: 'user-123' })

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
    const flow = createFlow<UserInput>({ name: 'Welcome Test' })
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

    const result = await flow.execute({ userId: 'user-456' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.message).toBe('Welcome back, Bob! Your light theme is ready.')
  })

  it('returns failure when a step throws', async () => {
    const flow = createFlow<UserInput>({ name: 'Failing Flow' }).step<UserData>({
      name: 'Fetch User',
      execute: async () => {
        throw new Error('Network error')
      },
    })

    const result = await flow.execute({ userId: 'user-999' })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toBe('Network error')
  })

  it('uses default step names (Step 0, Step 1, ...) when name is omitted', async () => {
    const onStepStart = jest.fn()

    const flow = createFlow<UserInput>({
      name: 'Default Names Test',
      analytics: {
        onStepStart,
        onStepComplete: jest.fn(),
        onStepSkipped: jest.fn(),
        onFlowComplete: jest.fn(),
        onFlowError: jest.fn(),
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

    await flow.execute({ userId: 'user-123' })

    expect(onStepStart).toHaveBeenNthCalledWith(1, 'Step 0', expect.anything())
    expect(onStepStart).toHaveBeenNthCalledWith(2, 'Step 1', expect.anything())
    expect(onStepStart).toHaveBeenNthCalledWith(3, 'Step 2', expect.anything())
  })

  it('calls analytics hooks during execution', async () => {
    const onStepStart = jest.fn()
    const onStepComplete = jest.fn()
    const onFlowComplete = jest.fn()

    const flow = createFlow<UserInput>({
      name: 'Analytics Test',
      analytics: {
        onStepStart,
        onStepComplete,
        onStepSkipped: jest.fn(),
        onFlowComplete,
        onFlowError: jest.fn(),
      },
    }).step<UserData>({
      name: 'Fetch User',
      execute: async (_input) => ({ userName: 'Alice', email: 'alice@example.com' }),
    })

    await flow.execute({ userId: 'user-123' })

    expect(onStepStart).toHaveBeenCalledWith(
      'Fetch User',
      expect.objectContaining({ userId: 'user-123' }),
    )
    expect(onStepComplete).toHaveBeenCalledWith(
      'Fetch User',
      expect.objectContaining({ success: true }),
      expect.any(Number),
    )
    expect(onFlowComplete).toHaveBeenCalledWith('Analytics Test', expect.any(Number))
  })
})
