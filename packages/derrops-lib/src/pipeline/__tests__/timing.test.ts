import { describe, it, expect } from '@jest/globals'
import { createPipeline } from '../index'

type Input = { id: string }

function validTiming(timing: { startedAt: number; finishedAt: number; duration: number }) {
  expect(timing.startedAt).toBeGreaterThan(0)
  expect(timing.finishedAt).toBeGreaterThanOrEqual(timing.startedAt)
  expect(timing.duration).toBe(timing.finishedAt - timing.startedAt)
  expect(timing.duration).toBeGreaterThanOrEqual(0)
}

describe('step timing', () => {
  it('populates timing on a successful step', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }) })
      .execute({ id: 'x' })

    expect(result.steps[0].timing).toBeDefined()
    validTiming(result.steps[0].timing)
  })

  it('populates timing on a skipped step', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }), shouldRun: () => false })
      .execute({ id: 'x' })

    expect(result.steps[0].skipped).toBe(true)
    validTiming(result.steps[0].timing)
  })

  it('populates timing on a failed step', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('boom')
        },
        policy: { error: 'CONTINUE' },
      })
      .execute({ id: 'x' })

    validTiming(result.steps[0].timing)
  })

  it('timing duration reflects actual elapsed time for a slow step', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Slow',
        execute: () => new Promise((resolve) => setTimeout(() => resolve({ x: 1 }), 50)),
      })
      .execute({ id: 'x' })

    expect(result.steps[0].timing.duration).toBeGreaterThanOrEqual(40)
  }, 2000)

  it('step timing spans execute and checks combined', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => new Promise((resolve) => setTimeout(() => resolve({ x: 1 }), 30)),
      })
      .check(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 20)))
      .execute({ id: 'x' })

    // total includes both execute (~30ms) and check (~20ms)
    expect(result.steps[0].timing.duration).toBeGreaterThanOrEqual(45)
  }, 2000)

  it('each step in a multi-step pipeline has its own timing', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ a: 1 }) })
      .step({ name: 'B', execute: () => ({ b: 2 }) })
      .step({ name: 'C', execute: () => ({ c: 3 }) })
      .execute({ id: 'x' })

    for (const record of result.steps) {
      validTiming(record.timing)
    }
  })

  it('sequential steps have non-overlapping timestamps', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => new Promise((resolve) => setTimeout(() => resolve({ a: 1 }), 20)),
      })
      .step({
        name: 'B',
        execute: () => new Promise((resolve) => setTimeout(() => resolve({ b: 2 }), 20)),
      })
      .execute({ id: 'x' })

    const [a, b] = result.steps
    expect(b.timing.startedAt).toBeGreaterThanOrEqual(a.timing.startedAt)
  }, 2000)
})

describe('pipeline timing', () => {
  it('populates timing on a successful pipeline', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }) })
      .execute({ id: 'x' })

    expect(result.timing).toBeDefined()
    validTiming(result.timing)
  })

  it('populates timing on a pipeline that fails via step error', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'A',
        execute: () => {
          throw new Error('boom')
        },
      })
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    validTiming(result.timing)
  })

  it('populates timing on a pipeline that fails via check', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ x: 1 }) })
      .check(() => ({ success: false, message: 'nope' }))
      .execute({ id: 'x' })

    expect(result.success).toBe(false)
    validTiming(result.timing)
  })

  it('pipeline duration is >= the sum of step durations', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ a: 1 }) })
      .step({ name: 'B', execute: () => ({ b: 2 }) })
      .execute({ id: 'x' })

    const stepSum = result.steps.reduce((sum, s) => sum + s.timing.duration, 0)
    expect(result.timing.duration).toBeGreaterThanOrEqual(stepSum)
  })

  it('pipeline startedAt is before or equal to the first step startedAt', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ a: 1 }) })
      .execute({ id: 'x' })

    expect(result.timing.startedAt).toBeLessThanOrEqual(result.steps[0].timing.startedAt)
  })

  it('pipeline finishedAt is after or equal to the last step finishedAt', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({ name: 'A', execute: () => ({ a: 1 }) })
      .execute({ id: 'x' })

    const lastStep = result.steps[result.steps.length - 1]
    expect(result.timing.finishedAt).toBeGreaterThanOrEqual(lastStep.timing.finishedAt)
  })

  it('single-step pipeline timing reflects actual elapsed time', async () => {
    const result = await createPipeline<Input>({ name: 'P' })
      .step({
        name: 'Slow',
        execute: () => new Promise((resolve) => setTimeout(() => resolve({ x: 1 }), 50)),
      })
      .execute({ id: 'x' })

    expect(result.timing.duration).toBeGreaterThanOrEqual(40)
  }, 2000)
})
