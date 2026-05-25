import { describe, it, expect } from '@jest/globals'
import { createPipeline } from '../index'

type Input = { id: string }

// ---------------------------------------------------------------------------
// Retry behaviour
// ---------------------------------------------------------------------------

describe('retries', () => {
  it('succeeds on the second attempt and calls onSuccess once', async () => {
    let attempts = 0
    let onSuccessCalls = 0
    let onFailureCalls = 0

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Flaky',
        execute: () => {
          attempts++
          if (attempts < 2) throw new Error('transient')
          return { done: true }
        },
        retries: 1,
        onSuccess: () => {
          onSuccessCalls++
        },
        onFailure: () => {
          onFailureCalls++
        },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
    expect(attempts).toBe(2)
    expect(onSuccessCalls).toBe(1)
    expect(onFailureCalls).toBe(0)
  })

  it('fails after all retries are exhausted and calls onFailure once', async () => {
    let onSuccessCalls = 0
    let onFailureCalls = 0
    let attempts = 0

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'AlwaysFails',
        execute: () => {
          attempts++
          throw new Error('permanent')
        },
        retries: 2,
        onSuccess: () => {
          onSuccessCalls++
        },
        onFailure: () => {
          onFailureCalls++
        },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    expect(attempts).toBe(3) // 1 original + 2 retries
    expect(onFailureCalls).toBe(1)
    expect(onSuccessCalls).toBe(0)
    if (result.success) return
    expect(result.error.message).toBe('permanent')
  })

  it('records all checks as NONE when execute fails', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Fail',
        execute: () => {
          throw new Error('boom')
        },
        policy: { error: 'CONTINUE' },
      })
      .check(() => ({ success: true }))
      .check(() => ({ success: true }))
      .execute({ id: 'x' })

    const record = result.steps[0]
    expect(record.executeFailed).toBe(true)
    expect(record.checks).toHaveLength(2)
    expect(record.checks[0].result.status).toBe('NONE')
    expect(record.checks[1].result.status).toBe('NONE')
  })

  it('records executeFailed=false when execute succeeds even if a check fails', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => ({ x: 1 }),
        policy: { failure: 'CONTINUE' },
      })
      .check(() => ({ success: false }))
      .execute({ id: 'x' })

    expect(result.steps[0].executeFailed).toBe(false)
    expect(result.steps[0].succeeded).toBe(false)
    expect(result.steps[0].checks[0].result.status).toBe('FAIL')
  })
})

// ---------------------------------------------------------------------------
// Timeout + CONTINUE policy
// ---------------------------------------------------------------------------

describe('timeout + CONTINUE policy', () => {
  it('next step runs after a timed-out step with CONTINUE policy', async () => {
    const ranSteps: string[] = []

    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Slow',
        execute: () => new Promise((resolve) => setTimeout(() => resolve({ slow: true }), 100)),
        timeout: 10,
        policy: { timeout: 'CONTINUE' },
      })
      .step({
        name: 'Fast',
        execute: () => {
          ranSteps.push('Fast')
          return { fast: true }
        },
        policy: { error: 'CONTINUE' },
      })
      .execute({ id: 'x' })

    expect(ranSteps).toContain('Fast')
    expect(result.steps[0].executeFailed).toBe(true)
    expect(result.steps[1].succeeded).toBe(true)
  })

  it('timed-out step is marked executeFailed=true', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Slow',
        execute: () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
        timeout: 10,
        policy: { timeout: 'CONTINUE' },
      })
      .execute({ id: 'x' })

    expect(result.steps[0].executeFailed).toBe(true)
    expect(result.steps[0].succeeded).toBe(false)
    expect(result.steps[0].skipped).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// successCriteria validation
// ---------------------------------------------------------------------------

describe('successCriteria validation', () => {
  it('throws on negative minStepsSuccessful', async () => {
    await expect(
      createPipeline<Input>({ name: 'P', successCriteria: { minStepsSuccessful: -1 } })
        .step({ name: 'A', execute: () => ({}) })
        .execute({ id: 'x' }),
    ).rejects.toThrow('minStepsSuccessful must be >= 0')
  })

  it('throws on negative maxStepsUnsuccessful', async () => {
    await expect(
      createPipeline<Input>({ name: 'P', successCriteria: { maxStepsUnsuccessful: -1 } })
        .step({ name: 'A', execute: () => ({}) })
        .execute({ id: 'x' }),
    ).rejects.toThrow('maxStepsUnsuccessful must be >= 0')
  })

  it('throws when minSuccessRate > 1', async () => {
    await expect(
      createPipeline<Input>({ name: 'P', successCriteria: { minSuccessRate: 1.5 } })
        .step({ name: 'A', execute: () => ({}) })
        .execute({ id: 'x' }),
    ).rejects.toThrow('minSuccessRate must be between 0 and 1')
  })

  it('throws when minSuccessRate < 0', async () => {
    await expect(
      createPipeline<Input>({ name: 'P', successCriteria: { minSuccessRate: -0.1 } })
        .step({ name: 'A', execute: () => ({}) })
        .execute({ id: 'x' }),
    ).rejects.toThrow('minSuccessRate must be between 0 and 1')
  })

  it('accepts minSuccessRate of exactly 0 and 1', async () => {
    const r0 = await createPipeline<Input>({ name: 'P', successCriteria: { minSuccessRate: 0 } })
      .step({ name: 'A', execute: () => ({}) })
      .execute({ id: 'x' })
    expect(r0.success).toBe(true)

    const r1 = await createPipeline<Input>({ name: 'P', successCriteria: { minSuccessRate: 1 } })
      .step({ name: 'A', execute: () => ({}) })
      .execute({ id: 'x' })
    expect(r1.success).toBe(true)
  })

  it('accepts maxStepsUnsuccessful of 0', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 0 },
    })
      .step({ name: 'A', execute: () => ({}) })
      .execute({ id: 'x' })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Edge cases: all steps skipped
// ---------------------------------------------------------------------------

describe('all steps skipped edge cases', () => {
  it('succeeds when all steps are skipped and no criteria are set', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}), shouldRun: () => false })
      .step({ name: 'B', execute: () => ({}), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })

  it('fails when minStepsSuccessful > 0 and all steps are skipped', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minStepsSuccessful: 1 },
    })
      .step({ name: 'A', execute: () => ({}), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
  })
})
