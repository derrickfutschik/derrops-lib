import { describe, it, expect } from '@jest/globals'
import { createPipeline } from '../index'

type Input = { id: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failStep(name: string) {
  return {
    name,
    execute: () => {
      throw new Error(`${name} failed`)
    },
    policy: { error: 'CONTINUE' as const },
  }
}

function passStep(name: string) {
  return { name, execute: () => ({}) }
}

// ---------------------------------------------------------------------------
// Default behaviour (no successCriteria)
// ---------------------------------------------------------------------------

describe('default success behaviour (no criteria)', () => {
  it('succeeds when all steps pass', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step(passStep('A'))
      .step(passStep('B'))
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })

  it('fails when any step fails', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step(passStep('A'))
      .step(failStep('B'))
      .step(passStep('C'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
  })

  it('fails when any check fails', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }) })
      .check(() => ({ success: false }))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
  })

  it('sets succeeded=true only on fully passing steps', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step(passStep('A'))
      .step(failStep('B'))
      .execute({ id: 'x' })

    expect(result.steps[0].succeeded).toBe(true)
    expect(result.steps[1].succeeded).toBe(false)
  })

  it('sets succeeded=false for skipped steps', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.steps[0].skipped).toBe(true)
    expect(result.steps[0].succeeded).toBe(false)
  })

  it('sets succeeded=false when a check fails', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }), policy: { failure: 'CONTINUE' } })
      .check(() => ({ success: false }))
      .execute({ id: 'x' })

    expect(result.steps[0].succeeded).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// minStepsSuccessful
// ---------------------------------------------------------------------------

describe('successCriteria.minStepsSuccessful', () => {
  it('succeeds when successful steps meet the minimum', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minStepsSuccessful: 2 },
    })
      .step(passStep('A'))
      .step(passStep('B'))
      .step(failStep('C'))
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })

  it('fails when successful steps are below the minimum', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minStepsSuccessful: 3 },
    })
      .step(passStep('A'))
      .step(failStep('B'))
      .step(failStep('C'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toMatch(/1 of 3 steps succeeded/)
    expect(result.terminated).toBe(false)
  })

  it('error message names the required minimum', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minStepsSuccessful: 4 },
    })
      .step(passStep('A'))
      .step(failStep('B'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toMatch(/minimum 4 required/)
  })

  it('skipped steps are excluded from the count', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minStepsSuccessful: 2 },
    })
      .step(passStep('A'))
      .step(passStep('B'))
      .step({ name: 'C', execute: () => ({}), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// maxStepsUnsuccessful
// ---------------------------------------------------------------------------

describe('successCriteria.maxStepsUnsuccessful', () => {
  it('succeeds when failures are within the allowed maximum', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 2 },
    })
      .step(passStep('A'))
      .step(failStep('B'))
      .step(failStep('C'))
      .step(passStep('D'))
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })

  it('fails when failures exceed the allowed maximum', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 1 },
    })
      .step(failStep('A'))
      .step(failStep('B'))
      .step(passStep('C'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toMatch(/2 steps failed \(maximum 1 allowed\)/)
  })

  it('maxStepsUnsuccessful: 0 matches default behaviour', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 0 },
    })
      .step(passStep('A'))
      .step(failStep('B'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
  })

  it('skipped steps are not counted as unsuccessful', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 0 },
    })
      .step(passStep('A'))
      .step({ name: 'B', execute: () => ({}), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// minSuccessRate
// ---------------------------------------------------------------------------

describe('successCriteria.minSuccessRate', () => {
  it('succeeds when success rate meets the threshold', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minSuccessRate: 0.5 },
    })
      .step(passStep('A'))
      .step(passStep('B'))
      .step(failStep('C'))
      .step(failStep('D'))
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })

  it('fails when success rate falls below the threshold', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minSuccessRate: 0.75 },
    })
      .step(passStep('A'))
      .step(failStep('B'))
      .step(failStep('C'))
      .step(failStep('D'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toMatch(/25% of steps succeeded \(minimum 75% required\)/)
  })

  it('rate of 1.0 matches default behaviour', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minSuccessRate: 1.0 },
    })
      .step(passStep('A'))
      .step(failStep('B'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
  })

  it('skipped steps are excluded from the rate denominator', async () => {
    // 2 passed, 1 skipped → rate = 2/2 = 1.0 — should pass 0.8 threshold
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minSuccessRate: 0.8 },
    })
      .step(passStep('A'))
      .step(passStep('B'))
      .step({ name: 'C', execute: () => ({}), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Multiple criteria (AND semantics)
// ---------------------------------------------------------------------------

describe('multiple criteria are AND-ed', () => {
  it('fails when only one criterion is violated', async () => {
    // minStepsSuccessful=2 is satisfied (2 passed), but minSuccessRate=0.75 is not (2/3 ≈ 67%)
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minStepsSuccessful: 2, minSuccessRate: 0.75 },
    })
      .step(passStep('A'))
      .step(passStep('B'))
      .step(failStep('C'))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
  })

  it('succeeds only when all criteria are satisfied', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { minStepsSuccessful: 2, maxStepsUnsuccessful: 1, minSuccessRate: 0.5 },
    })
      .step(passStep('A'))
      .step(passStep('B'))
      .step(failStep('C'))
      .execute({ id: 'x' })

    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Criteria applied on policy-triggered early stops
// ---------------------------------------------------------------------------

describe('criteria applied when pipeline halts early due to policy', () => {
  it('returns success when criteria are met even though a step stopped the pipeline', async () => {
    // default policy: error → STOP. But maxStepsUnsuccessful:1 allows this.
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 1 },
    })
      .step(passStep('A'))
      .step({
        name: 'B',
        execute: () => {
          throw new Error('B failed')
        },
      })
      .step(passStep('C'))
      .execute({ id: 'x' })

    // Pipeline stopped at B; only A and B ran; 1 failure ≤ max 1 → success
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(2)
  })

  it('returns failure when criteria are NOT met on an early stop', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 0 },
    })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('A failed')
        },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.terminated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TERMINAL check
// ---------------------------------------------------------------------------

describe('TERMINAL check', () => {
  it('records TERMINAL status on the triggering check', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }) })
      .check(() => ({ success: false, terminal: true, message: 'hard stop' }))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.terminated).toBe(true)
    expect(result.steps[0].checks[0].result.status).toBe('TERMINAL')
  })

  it('forces failure even with permissive successCriteria', async () => {
    const result = await createPipeline<Input>({
      name: 'P',
      successCriteria: { maxStepsUnsuccessful: 99 },
    })
      .step({ name: 'A', execute: () => ({ x: 1 }) })
      .check(() => ({ success: false, terminal: true, message: 'override' }))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.terminated).toBe(true)
  })

  it('stops remaining checks on the same step', async () => {
    const ranChecks: string[] = []

    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}) })
      .check(() => {
        ranChecks.push('first')
        return { success: false, terminal: true }
      })
      .check(() => {
        ranChecks.push('second')
        return { success: true }
      })
      .check(() => {
        ranChecks.push('third')
        return { success: true }
      })
      .execute({ id: 'x' })

    expect(ranChecks).toEqual(['first'])
    expect(result.success).toBe(false)

    // checks after the TERMINAL one are recorded as NONE
    expect(result.steps[0].checks[0].result.status).toBe('TERMINAL')
    expect(result.steps[0].checks[1].result.status).toBe('NONE')
    expect(result.steps[0].checks[2].result.status).toBe('NONE')
  })

  it('stops subsequent steps from running', async () => {
    const ranSteps: string[] = []

    await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          ranSteps.push('A')
          return {}
        },
      })
      .check(() => ({ success: false, terminal: true }))
      .step({
        name: 'B',
        execute: () => {
          ranSteps.push('B')
          return {}
        },
      })
      .execute({ id: 'x' })

    expect(ranSteps).toEqual(['A'])
  })

  it('uses the terminal check message as the pipeline error', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}) })
      .check('Fraud detected', () => ({
        success: false,
        terminal: true,
        message: 'fraudulent activity detected',
      }))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toBe('fraudulent activity detected')
  })

  it('uses the check name in the error when no message is provided', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}) })
      .check('Kill switch', () => ({ success: false, terminal: true }))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toContain('Kill switch')
  })

  it('sets succeeded=false on the step that held the terminal check', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({}) })
      .check(() => ({ success: false, terminal: true }))
      .execute({ id: 'x' })

    expect(result.steps[0].succeeded).toBe(false)
  })

  it('terminated=false on a normal (non-terminal) failure', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('err')
        },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.terminated).toBe(false)
  })
})
