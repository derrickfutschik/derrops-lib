# @derrops-lib

[![npm version](https://img.shields.io/npm/v/@derrops-lib.svg)](https://www.npmjs.com/package/@derrops-lib)
[![license](https://img.shields.io/npm/l/@derrops-lib.svg)](LICENSE)

A type-safe TypeScript library for building sequential data-enrichment pipelines. Each step receives everything accumulated so far, adds its own output, and passes the merged result to the next step. Checks can be attached to any step to assert business-logic conditions — and each step's `ContinuePolicy` controls what happens when something goes wrong.

## Features

- **Type-safe enrichment** — each step's output is merged into the accumulated type; TypeScript tracks the shape automatically so every subsequent step and check is fully typed
- **Chainable checks** — attach multiple named checks to any step via `.check(name, fn)`; checks run after execute and produce a rich `PASS | FAIL | ERROR | NONE | TERMINAL` status
- **Terminal checks** — a check can return `terminal: true` to force pipeline failure and skip all remaining checks, regardless of success criteria
- **`ContinuePolicy` per step** — declare how the pipeline should handle each failure mode (`error`, `failure`, `timeout`) directly on the step; all default to `STOP`
- **Conditional execution** — `shouldRun` predicates skip a step; its checks are recorded as `NONE`
- **Full retry policy** — configurable per step with attempt count, backoff strategies, per-mode retry conditions, delay caps, and pipeline restart support
- **Pipeline restarts** — `retry.restartFromStep` rewinds the pipeline to an earlier step when a step exhausts its retries
- **Success criteria** — override the default "all steps must succeed" verdict with `minStepsSuccessful`, `maxStepsUnsuccessful`, or `minSuccessRate`
- **Lifecycle callbacks** — `onSuccess` / `onFailure` / `onRetry` hooks per step
- **Timing records** — every step and the pipeline as a whole record `startedAt`, `finishedAt`, and `duration`
- **Analytics** — pluggable observer for step and pipeline events
- **Immutable builder** — `.step()` and `.check()` return a new pipeline instance; original is unchanged

## Install

```bash
npm install @derrops-lib
# or
yarn add @derrops-lib
# or
pnpm add @derrops-lib
```

## Quick Start

```typescript
import { createPipeline } from '@derrops-lib'

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

  // Optional: override the default "all steps must succeed" verdict
  successCriteria: {
    minStepsSuccessful: 2, // at least N non-skipped steps must succeed
    maxStepsUnsuccessful: 1, // at most N non-skipped steps may fail
    minSuccessRate: 0.8, // at least 80% of non-skipped steps must succeed
  },
})
```

All `successCriteria` fields are optional and can be combined. Skipped steps are excluded from all counts. TERMINAL checks always force failure regardless of criteria.

---

### `.step(config | fn)`

Appends a step. Returns a new pipeline whose accumulated type includes this step's output.

```typescript
pipeline.step({
  name: 'Step Name', // optional — defaults to 'Step 0', 'Step 1', …

  // Receives all accumulated data plus a read-only snapshot of previous step records
  execute: async (ctx, steps) => ({ result: 42 }),

  // Guard — return false to skip this step
  shouldRun: (ctx) => ctx.data.lintErrors === 0,

  onSuccess: (output, accumulated) => {
    /* called after execute succeeds, before checks */
  },
  onFailure: (error, accumulated) => {
    /* called after the last failed attempt */
  },
  onRetry: (error, attempt, delay, accumulated) => {
    /* called after each failed attempt, before the backoff delay and next attempt */
  },

  // Full retry policy — use instead of the deprecated `retries` shorthand
  retry: {
    maxAttempts: 4, // total attempts including the first
    backoff: { type: 'exponential', initialDelay: 250 }, // see Backoff Strategies below
    on: { onError: true, onTimeout: false }, // which failure modes are retried
    maxDelay: 10_000, // cap per-attempt delay
    maxTotalDelay: 30_000, // abort retry loop if cumulative delay would exceed this
    restartFromStep: 'Authenticate', // rewind pipeline to this step on final failure
    maxRestarts: 2, // max pipeline restarts (default: 1)
  },

  timeout: 5000, // ms limit per attempt

  // What to do when this step fails — all default to 'STOP'
  policy: {
    error: 'STOP', // execute threw a non-timeout exception
    failure: 'CONTINUE', // a check returned success: false
    timeout: 'STOP', // execute exceeded the timeout
  },
})
```

Bare function shorthand (equivalent to `{ execute: fn }`):

```typescript
pipeline.step(async (ctx) => ({ processed: true }))
```

#### Backoff Strategies

| Type          | Behaviour                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `none`        | Retry immediately with no delay (default)                                                      |
| `fixed`       | Same `delay` ms before every attempt                                                           |
| `exponential` | `initialDelay * multiplier^N` where N is the 0-based failure index; `multiplier` defaults to 2 |
| `steps`       | Explicit per-attempt delays; last value repeats once exhausted                                 |

```typescript
// Fixed delay
backoff: { type: 'fixed', delay: 500 }

// Exponential — 250 ms, 500 ms, 1000 ms, …
backoff: { type: 'exponential', initialDelay: 250 }

// Explicit cadence: 1 s, 5 s, 15 s, then 15 s for any further retries
backoff: { type: 'steps', delays: [1000, 5000, 15000] }
```

---

### `.check(fn)` / `.check(name, fn)`

Attaches a check to the most recently added step. Multiple `.check()` calls stack onto the same step and run in order after `execute` succeeds.

```typescript
pipeline
  .step({
    name: 'Validate',
    execute: async (ctx) => ({ score: computeScore(ctx) }),
    policy: { failure: 'STOP' }, // stop on any check failure (this is the default)
  })
  .check('Score positive', (ctx) => ({
    success: ctx.score > 0,
    message: `Score was ${ctx.score}`,
  }))
  .check('Score below limit', (ctx) => ({
    success: ctx.score < 1000,
    message: `Score ${ctx.score} exceeds limit`,
  }))
```

The check function receives two arguments:

1. **`ctx`** — the fully enriched data object (initial input + all previous steps + this step's output)
2. **`steps`** — a read-only array of `StepRecord` for every step that completed before the current one

```typescript
.check('Only if fetched', (ctx, steps) => ({
  success: steps.find(s => s.name === 'Fetch User')?.skipped
    ? true
    : ctx.user != null,
}))
```

**`CheckFnResult` fields:**

| Field      | Type      | Description                                                                             |
| ---------- | --------- | --------------------------------------------------------------------------------------- |
| `success`  | `boolean` | Whether the assertion passed                                                            |
| `message`  | `string?` | Human-readable reason; used as the pipeline error message on halt                       |
| `terminal` | `true?`   | When set, stops all remaining checks and forces pipeline failure regardless of criteria |

> All checks on a step always run to completion before the pipeline evaluates whether to halt — unless a check returns `terminal: true`, which short-circuits the remaining checks immediately.

---

### `.execute(initialInput)`

Runs the pipeline and returns a `PipelineResult`.

```typescript
const result = await pipeline.execute({ userId: 'u-1' })

// `data` is always present — even on failure
console.log(result.data)
console.log(result.timing.duration) // total ms

if (!result.success) {
  console.error(result.error.message)
  console.log(result.terminated) // true if a terminal check forced failure
}

console.log(result.restarts) // number of pipeline restarts triggered by restartFromStep
```

**`PipelineResult<TData>`:**

```typescript
type PipelineResult<TData> =
  | {
      success: true
      data: TData
      steps: StepRecord[]
      timing: Timing
      restarts: number
    }
  | {
      success: false
      data: TData
      error: Error
      steps: StepRecord[]
      timing: Timing
      terminated: boolean // true when a TERMINAL check forced failure
      restarts: number
    }
```

`data` is present in both branches so callers can inspect the fully enriched context even when the pipeline fails — important for access-control and audit pipelines that need to log what was learned before denying a request.

---

## Check Status

Every check produces a `CheckResult` with a `status` field:

| Status     | Meaning                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `PASS`     | Check ran and returned `success: true`                                                                 |
| `FAIL`     | Check ran and returned `success: false`                                                                |
| `ERROR`    | Check function threw an unexpected error                                                               |
| `NONE`     | Check did not run — either the step was skipped via `shouldRun`, or an earlier check was `TERMINAL`    |
| `TERMINAL` | Check returned `terminal: true` — forces pipeline failure, remaining checks on this step become `NONE` |

Whether a `FAIL` or `ERROR` halts the pipeline is controlled by `policy.failure` and `policy.error` on the step — not by the check result itself. A `TERMINAL` check always halts the pipeline regardless of policy.

Inspect check outcomes via `result.steps`:

```typescript
for (const step of result.steps) {
  console.log(step.name, step.skipped, step.executeFailed, step.succeeded)
  console.log(`duration: ${step.timing.duration}ms`)
  for (const attempt of step.attempts) {
    console.log(`attempt ${attempt.attempt}: timedOut=${attempt.timedOut}`)
  }
  for (const check of step.checks) {
    console.log(check.name, check.result.status, check.result.message)
  }
}
```

---

## Step and Pipeline Records

### `StepRecord`

Every step visited during a pipeline run produces a `StepRecord` in `result.steps`.

| Field           | Type              | Description                                                        |
| --------------- | ----------------- | ------------------------------------------------------------------ |
| `name`          | `string`          | Display name of the step                                           |
| `skipped`       | `boolean`         | `true` when `shouldRun` returned `false`                           |
| `executeFailed` | `boolean`         | `true` when `execute` threw (all retries exhausted)                |
| `succeeded`     | `boolean`         | `true` when the step ran, execute succeeded, and all checks passed |
| `attempts`      | `AttemptRecord[]` | One record per execute call made; empty for skipped steps          |
| `checks`        | `CheckRecord[]`   | Ordered list of check outcomes                                     |
| `timing`        | `Timing`          | Wall-clock metrics for the entire step (all attempts combined)     |

### `AttemptRecord`

Steps with a `retry` policy may make multiple execute calls. Each call produces one `AttemptRecord`.

| Field      | Type      | Description                                         |
| ---------- | --------- | --------------------------------------------------- |
| `attempt`  | `number`  | 1-based attempt number                              |
| `error`    | `Error?`  | The error thrown by this attempt; absent on success |
| `timedOut` | `boolean` | `true` when this attempt was aborted by `timeout`   |
| `timing`   | `Timing`  | Wall-clock metrics for this single attempt          |

### `Timing`

| Field        | Type     | Description                                  |
| ------------ | -------- | -------------------------------------------- |
| `startedAt`  | `number` | Unix timestamp (ms) when execution began     |
| `finishedAt` | `number` | Unix timestamp (ms) when execution completed |
| `duration`   | `number` | Elapsed milliseconds                         |

---

## Pipeline Success Rules

`result.success` is `true` only when the configured success criteria pass. By default (no `successCriteria`):

- every `execute` completed without throwing, **and**
- every check on every step returned `PASS`

With `successCriteria`, the threshold is relaxed — see `createPipeline` above. A TERMINAL check always forces `success: false` regardless of criteria.

A single `FAIL` or `ERROR` check anywhere sets `success: false` (unless overridden by `successCriteria`). The `steps` array always contains a complete record of what happened.

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

`policy: { failure: 'CONTINUE' }` lets the pipeline keep running after a check fails, collecting as much context as possible before a final denial decision:

```typescript
import { createPipeline } from '@derrops-lib'

type AuthCtx = { authContext: { domain: string; ipAddress: string } }

const pipeline = createPipeline<AuthCtx>({ name: 'Auth Pipeline' })
  .step({
    name: 'IP Lookup',
    execute: async (ctx) => ({ ipCheck: await lookupIp(ctx.authContext.ipAddress) }),
    policy: { failure: 'CONTINUE' }, // keep going even if IP check fails
  })
  .check('IP not malicious', (ctx) => ({
    success: !ctx.ipCheck.isMalicious,
    message: `IP ${ctx.authContext.ipAddress} flagged as malicious`,
  }))

  .step({
    name: 'Resolve Tenant',
    execute: async (ctx) => ({ tenant: await findTenant(ctx.authContext.domain) }),
    policy: { failure: 'CONTINUE' }, // keep going even if tenant lookup fails
  })
  .check('Tenant exists', (ctx) => ({
    success: ctx.tenant !== undefined,
  }))
  .check('IP whitelisted', (ctx) => ({
    success: ctx.tenant?.allowedIps.includes(ctx.authContext.ipAddress) ?? false,
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

Use the `retry` policy for full control over retry behaviour:

```typescript
pipeline.step({
  name: 'Flaky API Call',
  execute: async (ctx) => fetchWithRetry(ctx.url),
  retry: {
    maxAttempts: 4, // 1 initial + 3 retries
    backoff: { type: 'exponential', initialDelay: 200 }, // 200 ms, 400 ms, 800 ms, …
    maxDelay: 5000, // cap each delay at 5 s
    on: { onError: true, onTimeout: true }, // retry both errors and timeouts
  },
  timeout: 2000, // each attempt must complete within 2 s
  policy: { timeout: 'CONTINUE' }, // keep going if it still times out after all retries
  onRetry: (err, attempt, delay, ctx) => logger.warn('Retrying', { attempt, delay }),
  onFailure: (err, ctx) => logger.error('All retries failed', { err, ctx }),
})
```

Timeouts throw a `StepTimeoutError` (a subclass of `Error`), which lets the policy distinguish between a timeout and a regular execute error.

### Pipeline Restarts (`restartFromStep`)

When a step exhausts its retries, `retry.restartFromStep` rewinds the pipeline to an earlier step and re-runs from there — useful when a downstream failure means earlier work (e.g. token refresh) needs to be repeated.

```typescript
import { createPipeline } from '@derrops-lib'

const pipeline = createPipeline<{ url: string }>({ name: 'Auth + Call' })
  .step({
    name: 'Authenticate',
    execute: async (ctx) => ({ token: await getToken() }),
  })
  .step({
    name: 'Call API',
    execute: async (ctx) => ({
      response: await fetch(ctx.url, { headers: { Authorization: ctx.token } }),
    }),
    retry: {
      maxAttempts: 3,
      backoff: { type: 'fixed', delay: 500 },
      restartFromStep: 'Authenticate', // rewind and re-authenticate on final failure
      maxRestarts: 2, // allow up to 2 full pipeline restarts
    },
    policy: { error: 'STOP' },
  })
```

`restartFromStep` accepts a step name (`string`) or a 0-based index (`number`). The target must be an earlier step. `maxRestarts` defaults to `1`.

---

## Analytics

```typescript
import { AnalyticsCollector } from '@derrops-lib'

const analytics: AnalyticsCollector = {
  onStepStart: (name, input) => trace.start(name),
  onStepAttempt: (name, attempt, error, delay) =>
    logger.warn(`${name} attempt ${attempt} failed, retrying in ${delay}ms`),
  onStepComplete: (name, result, ms) => metrics.record(name, ms, result.success),
  onStepSkipped: (name, reason) => logger.info(`${name} skipped: ${reason}`),
  onPipelineRestart: (pipelineName, fromStep, restartNumber) =>
    logger.info(`Restarting from "${fromStep}" (restart #${restartNumber})`),
  onPipelineComplete: (name, totalMs) => metrics.pipelineDuration(name, totalMs),
  onPipelineError: (name, error) => logger.error(`${name} crashed`, error),
}

const pipeline = createPipeline<Input>({ name: 'My Pipeline', analytics })
```

**Events:**

| Event                | When fired                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| `onStepStart`        | Immediately before a step's first execute call                          |
| `onStepAttempt`      | After each failed attempt, before the backoff delay (not on the last)   |
| `onStepComplete`     | After execute completes (success or final failure) and after all checks |
| `onStepSkipped`      | When `shouldRun` returned `false`                                       |
| `onPipelineRestart`  | When `restartFromStep` rewinds the pipeline to an earlier step          |
| `onPipelineComplete` | After all steps complete, before returning the result                   |
| `onPipelineError`    | When an unexpected error escapes the pipeline's own error handling      |

## License

MIT
