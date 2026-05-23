/**
 * Build Pipeline Example
 *
 * This example demonstrates:
 * - Data enrichment: each step adds to accumulated data
 * - Type safety: TypeScript tracks the full accumulated type
 * - Conditional execution: steps can be skipped based on accumulated data
 * - Custom analytics: track metrics for each step
 * - Error handling: retries, timeouts, and failure callbacks
 */

import { createFlow, AnalyticsCollector, StepResult } from '../index'

// ============================================================================
// TYPE DEFINITIONS - Each step defines ONLY what it produces
// ============================================================================

type ProjectConfig = {
  projectName: string
  sourceDir: string
  environment: 'dev' | 'staging' | 'prod'
}

type LintOutput = {
  lintErrors: number
  lintWarnings: number
  filesLinted: string[]
}

type CompileOutput = {
  compiledFiles: string[]
  compileDuration: number
  typeErrors: number
}

type BundleOutput = {
  bundlePath: string
  bundleSize: number
  chunks: string[]
}

type TestOutput = {
  testsPassed: number
  testsFailed: number
  coverage: number
}

type DeployOutput = {
  deploymentUrl: string
  deployedVersion: string
  deployedAt: Date
}

// ============================================================================
// CUSTOM ANALYTICS IMPLEMENTATION
// ============================================================================

class BuildAnalytics implements AnalyticsCollector {
  private metrics: Array<{
    step: string
    status: 'started' | 'completed' | 'failed' | 'skipped'
    timestamp: Date
    duration?: number
    data?: unknown
  }> = []

  onStepStart(stepName: string, input: unknown): void {
    console.log(`\n🚀 [${stepName}] Starting...`)
    console.log(`   Input keys:`, Object.keys(input as object).join(', '))

    this.metrics.push({
      step: stepName,
      status: 'started',
      timestamp: new Date(),
    })
  }

  onStepComplete(stepName: string, result: StepResult, duration: number): void {
    const emoji = result.success ? '✅' : '❌'
    console.log(`${emoji} [${stepName}] Completed in ${duration}ms`)

    if (result.success) {
      console.log(`   Output keys:`, Object.keys(result.data as object).join(', '))
    } else {
      console.error(`   Error:`, result.error.message)
    }

    this.metrics.push({
      step: stepName,
      status: result.success ? 'completed' : 'failed',
      timestamp: new Date(),
      duration,
      data: result.success ? result.data : { error: result.error.message },
    })
  }

  onStepSkipped(stepName: string, reason: string): void {
    console.log(`⏭️  [${stepName}] Skipped - ${reason}`)

    this.metrics.push({
      step: stepName,
      status: 'skipped',
      timestamp: new Date(),
    })
  }

  onFlowComplete(flowName: string, totalDuration: number): void {
    console.log(`\n🎉 [${flowName}] Flow completed successfully in ${totalDuration}ms`)
    this.printSummary()
  }

  onFlowError(flowName: string, error: Error): void {
    console.error(`\n💥 [${flowName}] Flow failed:`, error.message)
    this.printSummary()
  }

  private printSummary(): void {
    console.log('\n📊 Build Summary:')
    console.log('═══════════════════════════════════════')

    this.metrics.forEach((metric) => {
      const duration = metric.duration ? ` (${metric.duration}ms)` : ''
      console.log(`  ${metric.step}: ${metric.status}${duration}`)
    })

    console.log('═══════════════════════════════════════\n')
  }

  getMetrics() {
    return this.metrics
  }
}

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

async function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// BUILD THE FLOW
// ============================================================================

const analytics = new BuildAnalytics()

const buildPipeline = createFlow<ProjectConfig>({ name: 'Build Pipeline', analytics })
  // Step 1: Lint
  // Input: ProjectConfig
  // Output: ProjectConfig & LintOutput
  .step<LintOutput>({
    name: 'Lint',
    execute: async (data) => {
      await simulateWork(100)
      console.log(`  Linting ${data.sourceDir}...`)

      return {
        lintErrors: 0,
        lintWarnings: 2,
        filesLinted: ['index.ts', 'utils.ts', 'types.ts'],
      }
    },
    retries: 1,
    timeout: 10000,
  })

  // Step 2: Compile
  // Input: ProjectConfig & LintOutput
  // Output: ProjectConfig & LintOutput & CompileOutput
  .step<CompileOutput>({
    name: 'Compile',
    execute: async (data) => {
      await simulateWork(200)
      // Can access lint results!
      console.log(`  Compiling ${data.filesLinted.length} files...`)

      return {
        compiledFiles: data.filesLinted.map((f) => f.replace('.ts', '.js')),
        compileDuration: 200,
        typeErrors: 0,
      }
    },
    shouldRun: (ctx) => {
      // Only compile if there are no lint errors
      return ctx.data.lintErrors === 0
    },
    onSuccess: (result) => {
      console.log(`  ✨ Generated ${result.compiledFiles.length} files`)
    },
  })

  // Step 3: Bundle
  // Input: ProjectConfig & LintOutput & CompileOutput
  // Output: + BundleOutput
  .step<BundleOutput>({
    name: 'Bundle',
    execute: async (data) => {
      await simulateWork(150)
      console.log(`  Bundling ${data.compiledFiles.length} compiled files...`)

      return {
        bundlePath: `dist/${data.projectName}.bundle.js`,
        bundleSize: 245_000,
        chunks: ['main', 'vendor'],
      }
    },
    onSuccess: (result) => {
      const sizeMB = (result.bundleSize / 1024 / 1024).toFixed(2)
      console.log(`  📦 Bundle size: ${sizeMB} MB`)
    },
  })

  // Step 4: Test
  // Input: all previous outputs
  // Output: + TestOutput
  .step<TestOutput>({
    name: 'Test',
    execute: async (data) => {
      await simulateWork(300)
      console.log(`  Running tests against ${data.bundlePath}...`)

      return {
        testsPassed: 48,
        testsFailed: 0,
        coverage: 87.5,
      }
    },
    onSuccess: (result) => {
      console.log(
        `  🧪 Tests: ${result.testsPassed}/${result.testsPassed + result.testsFailed} passed`,
      )
      console.log(`  📈 Coverage: ${result.coverage}%`)
    },
  })

  // Step 5: Deploy
  // Input: everything accumulated
  // Output: + DeployOutput
  .step<DeployOutput>({
    name: 'Deploy',
    execute: async (data) => {
      await simulateWork(250)
      console.log(`  Deploying ${data.projectName} to ${data.environment}...`)
      console.log(`  Bundle: ${data.bundlePath} (${(data.bundleSize / 1024).toFixed(1)}KB)`)
      console.log(`  Tests: ${data.testsPassed}/${data.testsPassed + data.testsFailed} passed`)

      return {
        deploymentUrl: `https://${data.environment}.${data.projectName}.com`,
        deployedVersion: '1.0.0',
        deployedAt: new Date(),
      }
    },
    shouldRun: (ctx) => {
      // Only deploy if all tests passed and coverage is good
      return ctx.data.testsFailed === 0 && ctx.data.coverage >= 80
    },
    onSuccess: (output, accumulated) => {
      console.log(`\n  🚀 Deployed ${accumulated.projectName} to ${output.deploymentUrl}`)
    },
  })

// ============================================================================
// EXECUTE THE FLOW
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║   Software Build Pipeline Example     ║')
  console.log('╚════════════════════════════════════════╝')

  const result = await buildPipeline.execute({
    projectName: 'my-app',
    sourceDir: './src',
    environment: 'prod',
  })

  console.log('='.repeat(50))

  if (result.success) {
    console.log('✅ BUILD SUCCESSFUL!\n')
    console.log('📦 Final Accumulated Data:')
    console.log('─'.repeat(50))

    // result.data is fully typed with ALL accumulated fields
    const data = result.data

    console.log(`Project: ${data.projectName}`)
    console.log(`Environment: ${data.environment}`)
    console.log(`Files Linted: ${data.filesLinted.join(', ')}`)
    console.log(`Lint Warnings: ${data.lintWarnings}`)
    console.log(`Compiled Files: ${data.compiledFiles.join(', ')}`)
    console.log(`Compile Time: ${data.compileDuration}ms`)
    console.log(`Bundle: ${data.bundlePath}`)
    console.log(`Bundle Size: ${(data.bundleSize / 1024).toFixed(1)}KB`)
    console.log(`Tests Passed: ${data.testsPassed}`)
    console.log(`Coverage: ${data.coverage}%`)
    console.log(`Deployed To: ${data.deploymentUrl}`)
    console.log(`Version: ${data.deployedVersion}`)
    console.log(`Deployed At: ${data.deployedAt.toISOString()}`)
  } else {
    console.log('❌ BUILD FAILED!')
    console.error(`\nError: ${result.error.message}`)
  }

  console.log('='.repeat(50) + '\n')
}

main().catch(console.error)
