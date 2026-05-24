import { describe, it, expect } from '@jest/globals'
import { createPipeline } from '../index'
import { StepRecord } from '../types'

type Input = { id: string }

describe('previous steps parameter', () => {
  describe('execute', () => {
    it('first step receives an empty steps array', async () => {
      const capturedSteps: Array<readonly StepRecord[]> = []

      await createPipeline<Input>({ name: 'P' })
        .step({
          name: 'Step A',
          execute: (_input, steps) => {
            capturedSteps.push(steps)
            return { a: 1 }
          },
        })
        .execute({ id: 'x' })

      expect(capturedSteps[0]).toEqual([])
    })

    it('second step receives the completed record of the first step', async () => {
      const capturedSteps: Array<readonly StepRecord[]> = []

      await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Step A', execute: () => ({ a: 1 }) })
        .step({
          name: 'Step B',
          execute: (_input, steps) => {
            capturedSteps.push(steps)
            return { b: 2 }
          },
        })
        .execute({ id: 'x' })

      expect(capturedSteps[0]).toHaveLength(1)
      expect(capturedSteps[0][0].name).toBe('Step A')
      expect(capturedSteps[0][0].skipped).toBe(false)
    })

    it('third step receives records from both prior steps in order', async () => {
      const capturedSteps: Array<readonly StepRecord[]> = []

      await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Step A', execute: () => ({ a: 1 }) })
        .step({ name: 'Step B', execute: () => ({ b: 2 }) })
        .step({
          name: 'Step C',
          execute: (_input, steps) => {
            capturedSteps.push(steps)
            return { c: 3 }
          },
        })
        .execute({ id: 'x' })

      expect(capturedSteps[0]).toHaveLength(2)
      expect(capturedSteps[0][0].name).toBe('Step A')
      expect(capturedSteps[0][1].name).toBe('Step B')
    })

    it('marks a skipped step as skipped in the record seen by later steps', async () => {
      const capturedSteps: Array<readonly StepRecord[]> = []

      await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Step A', execute: () => ({ a: 1 }) })
        .step({
          name: 'Step B',
          execute: () => ({ b: 2 }),
          shouldRun: () => false,
        })
        .step({
          name: 'Step C',
          execute: (_input, steps) => {
            capturedSteps.push(steps)
            return { c: 3 }
          },
        })
        .execute({ id: 'x' })

      expect(capturedSteps[0]).toHaveLength(2)
      expect(capturedSteps[0][1].name).toBe('Step B')
      expect(capturedSteps[0][1].skipped).toBe(true)
    })

    it('step can branch its output based on a prior step being skipped', async () => {
      const result = await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Fetch', execute: () => ({ fetched: true }), shouldRun: () => false })
        .step({
          name: 'Enrich',
          execute: (_input, steps) => {
            const fetchSkipped = steps.find((s) => s.name === 'Fetch')?.skipped ?? false
            return { source: fetchSkipped ? 'cache' : 'remote' }
          },
        })
        .execute({ id: 'x' })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.source).toBe('cache')
    })

    it('step can branch based on a prior check outcome', async () => {
      const result = await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Validate', execute: () => ({ score: 40 }), policy: { failure: 'CONTINUE' } })
        .check('Score sufficient', (ctx) => ({ success: ctx.score >= 50 }))
        .step({
          name: 'Decide',
          execute: (_input, steps) => {
            const validateRecord = steps.find((s) => s.name === 'Validate')
            const checkPassed = validateRecord?.checks[0]?.result.status === 'PASS'
            return { approved: checkPassed }
          },
          policy: { failure: 'CONTINUE' },
        })
        .execute({ id: 'x' })

      expect(result.success).toBe(false)
      expect(result.data.approved).toBe(false)
    })

    it('does not include the current step in the steps array', async () => {
      const capturedNames: string[] = []

      await createPipeline<Input>({ name: 'P' })
        .step({
          name: 'Only Step',
          execute: (_input, steps) => {
            capturedNames.push(...steps.map((s) => s.name))
            return {}
          },
        })
        .execute({ id: 'x' })

      expect(capturedNames).not.toContain('Only Step')
    })
  })

  describe('check', () => {
    it('check on the first step receives an empty steps array', async () => {
      const capturedSteps: Array<readonly StepRecord[]> = []

      await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Step A', execute: () => ({ a: 1 }) })
        .check((_ctx, steps) => {
          capturedSteps.push(steps)
          return { success: true }
        })
        .execute({ id: 'x' })

      expect(capturedSteps[0]).toEqual([])
    })

    it('check on the second step receives the completed record of the first step', async () => {
      const capturedSteps: Array<readonly StepRecord[]> = []

      await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Step A', execute: () => ({ a: 1 }) })
        .step({ name: 'Step B', execute: () => ({ b: 2 }) })
        .check((_ctx, steps) => {
          capturedSteps.push(steps)
          return { success: true }
        })
        .execute({ id: 'x' })

      expect(capturedSteps[0]).toHaveLength(1)
      expect(capturedSteps[0][0].name).toBe('Step A')
    })

    it('check can fail based on a prior step being skipped', async () => {
      const result = await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Auth', execute: () => ({ token: '' }), shouldRun: () => false })
        .step({ name: 'Action', execute: () => ({ done: true }) })
        .check('Auth ran', (_ctx, steps) => ({
          success: steps.find((s) => s.name === 'Auth')?.skipped === false,
          message: 'Auth step was skipped',
        }))
        .execute({ id: 'x' })

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.message).toBe('Auth step was skipped')
    })

    it('multiple checks on the same step each receive the same steps snapshot', async () => {
      const snapshots: Array<readonly StepRecord[]> = []

      await createPipeline<Input>({ name: 'P' })
        .step({ name: 'Step A', execute: () => ({ a: 1 }) })
        .step({ name: 'Step B', execute: () => ({ b: 2 }) })
        .check((_ctx, steps) => {
          snapshots.push(steps)
          return { success: true }
        })
        .check((_ctx, steps) => {
          snapshots.push(steps)
          return { success: true }
        })
        .execute({ id: 'x' })

      expect(snapshots).toHaveLength(2)
      expect(snapshots[0]).toHaveLength(1)
      expect(snapshots[1]).toHaveLength(1)
      expect(snapshots[0][0].name).toBe('Step A')
      expect(snapshots[1][0].name).toBe('Step A')
    })
  })
})
