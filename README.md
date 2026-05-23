# Pipeline Builder

A type-safe TypeScript library for building sequential data-enrichment pipelines. Each step receives everything accumulated so far, adds its own output, and passes the merged result to the next step. Checks can be attached to any step to assert business-logic conditions — with fine-grained control over whether a failing check stops the pipeline or lets it keep running.

## Features

- **Type-safe enrichment** — each step's output is merged into the accumulated type; TypeScript tracks the shape automatically so every subsequent step and check is fully typed
- **Chainable checks** — attach multiple named checks to any step via `.check(name, fn)`; checks run after execute and produce a rich `PASS | FAIL | ERROR | NONE` status
- **Granular pipeline control** — checks with `continue: true` mark the pipeline as failed but let subsequent steps keep running (useful for audit/logging pipelines that need to gather all context before making a decision)
- **Conditional execution** — `shouldRun` predicates skip a step; its checks are recorded as `NONE`
- **Retries & timeouts** — configurable per step
- **Lifecycle callbacks** — `onSuccess` / `onFailure` hooks per step
- **Analytics** — pluggable observer for step and pipeline events
- **Immutable builder** — `.step()` and `.check()` return a new pipeline instance; original is unchanged

## Quick Start

```typescript
import { createPipeline } from 'pipeline-builder'

type UserInput = { userId: string }

const pipeline = createPipeline<UserInput>({ name: 'User Onboarding' })
  .step({
    name: 'Fetch User',
    execute: async (ctx) => ({ userName: 'Alice', email: 'alice@example.com' }),
  })
  .step({
    name: 'Load Preferences',
    execute: async (ctx) => ({ theme: 'dark' as const }),
  })

const result = await pipeline.execute({ userId: 'u-1' })

if (result.success) {
  console.log(result.data.userName) // 'Alice'
  console.log(result.data.theme) // 'dark'
}
```

## API

### `createPipeline<TInitial>(config)`

Creates a new pipeline. `TInitial` is the shape passed to `.execute()`.

```typescript
const pipeline = createPipeline<{ userId: string }>({
  name: 'My Pipeline',
  analytics: myAnalytics, // optional — see Analytics section
  continueOnError: false, // optional, default: false
})
```

---

### `.step(config | fn)`

Appends a step. Returns a new pipeline whose accumulated type includes this step's output.

```typescript
pipeline.step({
  name: 'Step Name', // optional — defaults to 'Step 0', 'Step 1', …
  execute: async (ctx) => ({ result: 42 }),

  // Guard — return false to skip this step
  shouldRun: (ctx) => ctx.data.lintErrors === 0,

  onSuccess: (output, accumulated) => {
    /* called after execute, before checks */
  },
  onFailure: (error, accumulated) => {
    /* called after last failed attempt */
  },

  retries: 2, // additional attempts on throw (0 = one attempt total)
  timeout: 5000, // ms limit per attempt
})
```

Bare function shorthand (equivalent to `{ execute: fn }`):

```typescript
pipeline.step(async (ctx) => ({ processed: true }))
```

---

### `.check(fn)` / `.check(name, fn)`

Attaches a check to the most recently added step. Multiple `.check()` calls stack onto the same step and run in order after `execute` succeeds.

```typescript
pipeline
  .step({ name: 'Validate', execute: async (ctx) => ({ score: computeScore(ctx) }) })
  .check('Score positive', (ctx) => ({
    success: ctx.score > 0,
    message: `Score was ${ctx.score}`,
    continue: false, // stop the pipeline on failure
  }))
  .check('Score below limit', (ctx) => ({
    success: ctx.score < 1000,
    message: `Score ${ctx.score} exceeds limit`,
    continue: true, // keep running even if this fails
  }))
```

The check function receives the fully enriched data object — every field from the initial input and all previous steps, plus this step's output — as its single argument.

**`CheckFnResult` fields:**

| Field      | Type      | Description                                                                                        |
| ---------- | --------- | -------------------------------------------------------------------------------------------------- |
| `success`  | `boolean` | Whether the assertion passed                                                                       |
| `message`  | `string?` | Human-readable reason; used as the pipeline error message when `continue` is `false`               |
| `continue` | `boolean` | `false` → stop pipeline after all checks on this step finish; `true` → keep running even if failed |

> All checks on a step always run to completion, even when an earlier check sets `continue: false`. The pipeline halts _after_ the step, never mid-step.

---

### `.execute(initialInput)`

Runs the pipeline and returns a `FlowResult`.

```typescript
const result = await pipeline.execute({ userId: 'u-1' })

// `data` is always present — even on failure
console.log(result.data)

if (!result.success) {
  console.error(result.error.message)
}
```

**`FlowResult<TData>`:**

```typescript
type PipelineResult<TData> =
  | { success: true; data: TData; steps: StepRecord[] }
  | { success: false; data: TData; error: Error; steps: StepRecord[] }
```

`data` is present in both branches so callers can inspect the fully enriched context even when the pipeline fails — important for access-control and audit pipelines that need to log what was learned before denying a request.

---

## Check Status

Every check produces a `CheckResult` with a `status` field:

| Status  | Meaning                                                                  |
| ------- | ------------------------------------------------------------------------ |
| `PASS`  | Check ran and returned `success: true`                                   |
| `FAIL`  | Check ran and returned `success: false`                                  |
| `ERROR` | Check function threw an unexpected error; `continue` defaults to `false` |
| `NONE`  | Check did not run because its step was skipped via `shouldRun`           |

Inspect check outcomes via `result.steps`:

```typescript
for (const step of result.steps) {
  console.log(step.name, step.skipped)
  for (const check of step.checks) {
    console.log(check.name, check.result.status, check.result.message)
  }
}
```

---

## Pipeline Success Rules

`result.success` is `true` only when:

- every `execute` completed without throwing, **and**
- every check on every step returned `PASS`

A single `FAIL` or `ERROR` check anywhere sets `success: false`, even if all subsequent steps ran. The `steps` array always contains a complete record of what happened.

---

## Data Enrichment

Each step receives the full accumulated object and adds new fields:

```
Initial:      { userId: 'u-1' }
              ↓ Fetch User
Accumulated:  { userId: 'u-1', userName: 'Alice', email: 'alice@example.com' }
              ↓ Load Preferences
Accumulated:  { userId: 'u-1', userName: 'Alice', email: 'alice@example.com', theme: 'dark' }
```

TypeScript tracks this at compile time — every step and check has full autocomplete and type checking.

---

## Access Control Example

The check system is particularly useful for pipelines that need to collect as much diagnostic context as possible before making an access decision, even when individual checks fail:

```typescript
type AuthCtx = { authContext: { domain: string; ipAddress: string } }

const pipeline = createPipeline<AuthCtx>({ name: 'Auth Pipeline' })
  .step({
    name: 'IP Lookup',
    execute: async (ctx) => ({ ipCheck: await lookupIp(ctx.authContext.ipAddress) }),
  })
  .check('IP not malicious', (ctx) => ({
    success: !ctx.ipCheck.isMalicious,
    message: `IP ${ctx.authContext.ipAddress} flagged as malicious`,
    continue: true, // keep going to gather more context
  }))

  .step({
    name: 'Resolve Tenant',
    execute: async (ctx) => ({ tenant: await findTenant(ctx.authContext.domain) }),
  })
  .check('Tenant exists', (ctx) => ({
    success: ctx.tenant !== undefined,
    continue: true,
  }))
  .check('IP whitelisted', (ctx) => ({
    success: ctx.tenant?.allowedIps.includes(ctx.authContext.ipAddress) ?? false,
    continue: true,
  }))

const result = await pipeline.execute({
  authContext: { domain: 'example.com', ipAddress: '1.2.3.4' },
})

// result.success → false if any check failed
// result.data    → fully enriched, always available for logging
// result.steps   → per-step check records with PASS/FAIL/ERROR/NONE status
```

---

## Conditional Steps (`shouldRun`)

```typescript
pipeline
  .step({
    name: 'Lint',
    execute: async (ctx) => ({ lintErrors: runLint(ctx.sourceDir) }),
  })
  .step({
    name: 'Compile',
    execute: async (ctx) => ({ compiledFiles: compile(ctx.sourceDir) }),
    shouldRun: (ctx) => ctx.data.lintErrors === 0, // skip if lint failed
  })
```

`shouldRun` receives a `StepContext` with a `data` field containing the current accumulated data. When it returns `false`, all checks attached to that step are recorded with status `NONE`.

---

## Retries & Timeouts

```typescript
pipeline.step({
  name: 'Flaky API Call',
  execute: async (ctx) => fetchWithRetry(ctx.url),
  retries: 3, // up to 4 total attempts
  timeout: 2000, // each attempt must complete within 2 s
  onFailure: (err, ctx) => logger.error('All retries failed', { err, ctx }),
})
```

---

## Analytics

```typescript
import { AnalyticsCollector } from 'pipeline-builder'

const analytics: AnalyticsCollector = {
  onStepStart: (name, input) => trace.start(name),
  onStepComplete: (name, result, ms) => metrics.record(name, ms, result.success),
  onStepSkipped: (name, reason) => logger.info(`${name} skipped: ${reason}`),
  onPipelineComplete: (name, totalMs) => metrics.pipelineDuration(name, totalMs),
  onPipelineError: (name, error) => logger.error(`${name} crashed`, error),
}

const pipeline = createPipeline<Input>({ name: 'My Pipeline', analytics })
```

## License

MIT
