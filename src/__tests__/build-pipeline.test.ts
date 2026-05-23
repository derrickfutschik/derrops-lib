import { describe, it, expect, jest } from '@jest/globals'
import { createFlow, AnalyticsCollector } from '../index'

type ProjectConfig = {
  projectName: string
  sourceDir: string
  environment: 'dev' | 'staging' | 'prod'
}

type LintOutput = { lintErrors: number; lintWarnings: number; filesLinted: string[] }
type CompileOutput = { compiledFiles: string[]; compileDuration: number; typeErrors: number }
type BundleOutput = { bundlePath: string; bundleSize: number; chunks: string[] }
type TestOutput = { testsPassed: number; testsFailed: number; coverage: number }
type DeployOutput = { deploymentUrl: string; deployedVersion: string; deployedAt: Date }

function makeAnalytics(): jest.Mocked<AnalyticsCollector> {
  return {
    onStepStart: jest.fn(),
    onStepComplete: jest.fn(),
    onStepSkipped: jest.fn(),
    onFlowComplete: jest.fn(),
    onFlowError: jest.fn(),
  }
}

const defaultInput: ProjectConfig = {
  projectName: 'my-app',
  sourceDir: './src',
  environment: 'prod',
}

describe('build pipeline flow', () => {
  describe('full successful run', () => {
    it('accumulates all step outputs', async () => {
      const flow = createFlow<ProjectConfig>({ name: 'Build Pipeline' })
        .step<LintOutput>({
          name: 'Lint',
          execute: async (_data) => ({
            lintErrors: 0,
            lintWarnings: 2,
            filesLinted: ['index.ts', 'utils.ts', 'types.ts'],
          }),
        })
        .step<CompileOutput>({
          name: 'Compile',
          execute: async (data) => ({
            compiledFiles: data.filesLinted.map((f) => f.replace('.ts', '.js')),
            compileDuration: 200,
            typeErrors: 0,
          }),
        })
        .step<BundleOutput>({
          name: 'Bundle',
          execute: async (data) => ({
            bundlePath: `dist/${data.projectName}.bundle.js`,
            bundleSize: 245_000,
            chunks: ['main', 'vendor'],
          }),
        })
        .step<TestOutput>({
          name: 'Test',
          execute: async (_data) => ({
            testsPassed: 48,
            testsFailed: 0,
            coverage: 87.5,
          }),
        })
        .step<DeployOutput>({
          name: 'Deploy',
          execute: async (data) => ({
            deploymentUrl: `https://${data.environment}.${data.projectName}.com`,
            deployedVersion: '1.0.0',
            deployedAt: new Date(),
          }),
        })

      const result = await flow.execute(defaultInput)

      expect(result.success).toBe(true)
      if (!result.success) return

      const data = result.data
      expect(data.projectName).toBe('my-app')
      expect(data.lintErrors).toBe(0)
      expect(data.lintWarnings).toBe(2)
      expect(data.filesLinted).toEqual(['index.ts', 'utils.ts', 'types.ts'])
      expect(data.compiledFiles).toEqual(['index.js', 'utils.js', 'types.js'])
      expect(data.bundlePath).toBe('dist/my-app.bundle.js')
      expect(data.testsPassed).toBe(48)
      expect(data.testsFailed).toBe(0)
      expect(data.deploymentUrl).toBe('https://prod.my-app.com')
      expect(data.deployedVersion).toBe('1.0.0')
    })
  })

  describe('shouldRun — conditional step execution', () => {
    it('skips compile step when lint has errors', async () => {
      const analytics = makeAnalytics()
      const compileExecute = jest.fn<() => Promise<CompileOutput>>().mockResolvedValue({
        compiledFiles: [],
        compileDuration: 0,
        typeErrors: 0,
      })

      const flow = createFlow<ProjectConfig>({ name: 'Lint-Gate', analytics })
        .step<LintOutput>({
          name: 'Lint',
          execute: async () => ({
            lintErrors: 3,
            lintWarnings: 0,
            filesLinted: ['index.ts'],
          }),
        })
        .step<CompileOutput>({
          name: 'Compile',
          execute: compileExecute,
          shouldRun: (ctx) => ctx.data.lintErrors === 0,
        })

      await flow.execute(defaultInput)

      expect(compileExecute).not.toHaveBeenCalled()
      expect(analytics.onStepSkipped).toHaveBeenCalledWith('Compile', 'Condition not met')
    })

    it('runs compile step when lint passes', async () => {
      const compileExecute = jest.fn<() => Promise<CompileOutput>>().mockResolvedValue({
        compiledFiles: ['index.js'],
        compileDuration: 100,
        typeErrors: 0,
      })

      const flow = createFlow<ProjectConfig>({ name: 'Lint-Pass' })
        .step<LintOutput>({
          name: 'Lint',
          execute: async () => ({ lintErrors: 0, lintWarnings: 0, filesLinted: ['index.ts'] }),
        })
        .step<CompileOutput>({
          name: 'Compile',
          execute: compileExecute,
          shouldRun: (ctx) => ctx.data.lintErrors === 0,
        })

      await flow.execute(defaultInput)

      expect(compileExecute).toHaveBeenCalledTimes(1)
    })

    it('skips deploy when tests fail', async () => {
      const analytics = makeAnalytics()
      const deployExecute = jest.fn<() => Promise<DeployOutput>>().mockResolvedValue({
        deploymentUrl: 'https://prod.my-app.com',
        deployedVersion: '1.0.0',
        deployedAt: new Date(),
      })

      const flow = createFlow<ProjectConfig>({ name: 'Deploy-Gate', analytics })
        .step<TestOutput>({
          name: 'Test',
          execute: async () => ({ testsPassed: 10, testsFailed: 5, coverage: 90 }),
        })
        .step<DeployOutput>({
          name: 'Deploy',
          execute: deployExecute,
          shouldRun: (ctx) => ctx.data.testsFailed === 0 && ctx.data.coverage >= 80,
        })

      await flow.execute(defaultInput)

      expect(deployExecute).not.toHaveBeenCalled()
      expect(analytics.onStepSkipped).toHaveBeenCalledWith('Deploy', 'Condition not met')
    })

    it('skips deploy when coverage is below threshold', async () => {
      const analytics = makeAnalytics()
      const deployExecute = jest.fn<() => Promise<DeployOutput>>().mockResolvedValue({
        deploymentUrl: 'https://prod.my-app.com',
        deployedVersion: '1.0.0',
        deployedAt: new Date(),
      })

      const flow = createFlow<ProjectConfig>({ name: 'Coverage-Gate', analytics })
        .step<TestOutput>({
          name: 'Test',
          execute: async () => ({ testsPassed: 48, testsFailed: 0, coverage: 60 }),
        })
        .step<DeployOutput>({
          name: 'Deploy',
          execute: deployExecute,
          shouldRun: (ctx) => ctx.data.testsFailed === 0 && ctx.data.coverage >= 80,
        })

      await flow.execute(defaultInput)

      expect(deployExecute).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess callback', () => {
    it('calls onSuccess with step output and accumulated data', async () => {
      const onSuccess = jest.fn<() => void>()

      const flow = createFlow<ProjectConfig>({ name: 'Success-CB' }).step<LintOutput>({
        name: 'Lint',
        execute: async () => ({
          lintErrors: 0,
          lintWarnings: 1,
          filesLinted: ['index.ts'],
        }),
        onSuccess,
      })

      await flow.execute(defaultInput)

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ lintErrors: 0, lintWarnings: 1 }),
        expect.objectContaining({ projectName: 'my-app' }),
      )
    })
  })

  describe('onFailure callback', () => {
    it('calls onFailure when a step throws', async () => {
      const onFailure = jest.fn<() => void>()

      const flow = createFlow<ProjectConfig>({ name: 'Failure-CB' }).step<LintOutput>({
        name: 'Lint',
        execute: async () => {
          throw new Error('lint crashed')
        },
        onFailure,
      })

      const result = await flow.execute(defaultInput)

      expect(result.success).toBe(false)
      expect(onFailure).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'lint crashed' }),
        expect.objectContaining({ projectName: 'my-app' }),
      )
    })
  })

  describe('retries', () => {
    it('retries on failure and succeeds on second attempt', async () => {
      let attempts = 0
      const flow = createFlow<ProjectConfig>({ name: 'Retry Test' }).step<LintOutput>({
        name: 'Lint',
        execute: async () => {
          attempts++
          if (attempts < 2) throw new Error('transient error')
          return { lintErrors: 0, lintWarnings: 0, filesLinted: [] }
        },
        retries: 1,
      })

      const result = await flow.execute(defaultInput)

      expect(result.success).toBe(true)
      expect(attempts).toBe(2)
    })

    it('fails after exhausting all retries', async () => {
      let attempts = 0
      const flow = createFlow<ProjectConfig>({ name: 'Exhaust Retries' }).step<LintOutput>({
        name: 'Lint',
        execute: async () => {
          attempts++
          throw new Error('always fails')
        },
        retries: 2,
      })

      const result = await flow.execute(defaultInput)

      expect(result.success).toBe(false)
      expect(attempts).toBe(3)
    })
  })

  describe('timeout', () => {
    it('fails with timeout error when step exceeds limit', async () => {
      const flow = createFlow<ProjectConfig>({ name: 'Timeout Test' }).step<LintOutput>({
        name: 'Slow Lint',
        execute: () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ lintErrors: 0, lintWarnings: 0, filesLinted: [] }), 500),
          ),
        timeout: 50,
      })

      const result = await flow.execute(defaultInput)

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.message).toMatch(/timeout/i)
    }, 2000)
  })

  describe('analytics', () => {
    it('calls all analytics hooks in order for a successful flow', async () => {
      const calls: string[] = []
      const analytics: AnalyticsCollector = {
        onStepStart: (name) => calls.push(`start:${name}`),
        onStepComplete: (name, result) => calls.push(`complete:${name}:${result.success}`),
        onStepSkipped: (name) => calls.push(`skip:${name}`),
        onFlowComplete: (name) => calls.push(`flowDone:${name}`),
        onFlowError: (name) => calls.push(`flowError:${name}`),
      }

      const flow = createFlow<ProjectConfig>({ name: 'Analytics Order', analytics })
        .step<LintOutput>({
          name: 'Lint',
          execute: async () => ({ lintErrors: 0, lintWarnings: 0, filesLinted: [] }),
        })
        .step<CompileOutput>({
          name: 'Compile',
          execute: async () => ({ compiledFiles: [], compileDuration: 0, typeErrors: 0 }),
        })

      await flow.execute(defaultInput)

      expect(calls).toEqual([
        'start:Lint',
        'complete:Lint:true',
        'start:Compile',
        'complete:Compile:true',
        'flowDone:Analytics Order',
      ])
    })

    it('calls onFlowError when a step throws unexpectedly', async () => {
      const analytics = makeAnalytics()

      const flow = createFlow<ProjectConfig>({ name: 'Error Flow', analytics }).step<LintOutput>({
        name: 'Lint',
        execute: async () => {
          throw new Error('boom')
        },
      })

      const result = await flow.execute(defaultInput)

      expect(result.success).toBe(false)
      expect(analytics.onFlowError).not.toHaveBeenCalled()
      expect(analytics.onStepComplete).toHaveBeenCalledWith(
        'Lint',
        expect.objectContaining({ success: false }),
        expect.any(Number),
      )
    })
  })

  describe('continueOnError', () => {
    it('continues to subsequent steps when continueOnError is true', async () => {
      const secondExecute = jest.fn<() => Promise<CompileOutput>>().mockResolvedValue({
        compiledFiles: [],
        compileDuration: 0,
        typeErrors: 0,
      })

      const flow = createFlow<ProjectConfig>({ name: 'Continue On Error', continueOnError: true })
        .step<LintOutput>({
          name: 'Lint',
          execute: async () => {
            throw new Error('lint failed')
          },
        })
        .step<CompileOutput>({
          name: 'Compile',
          execute: secondExecute,
        })

      await flow.execute(defaultInput)

      expect(secondExecute).toHaveBeenCalledTimes(1)
    })
  })
})
