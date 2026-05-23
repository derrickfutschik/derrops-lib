# Flow Builder

A type-safe TypeScript library for building sequential flows with automatic data enrichment, conditional execution, and analytics.

## Features

- **Type-Safe Data Enrichment**: Each step's output is automatically merged with accumulated data, with full TypeScript type inference
- **Conditional Execution**: Steps can be skipped based on accumulated data using `shouldRun`
- **Success/Failure Callbacks**: Handle step outcomes with `onSuccess` and `onFailure` hooks
- **Retries & Timeouts**: Built-in error handling with configurable retry counts and timeouts
- **Analytics**: Comprehensive hooks for tracking execution metrics
- **Immutable Flow Building**: Each `addStep` returns a new flow instance with updated types

## Installation

```bash
npm install
npm run build
```

## Quick Start

```typescript
import { createFlow } from 'flow-builder'

// Define what each step produces
type UserInput = { userId: string }
type UserData = { userName: string; email: string }
type Preferences = { theme: 'light' | 'dark' }

// Create the flow
const flow = createFlow<UserInput>({ name: 'User Flow' })
  .addStep<UserData>({
    name: 'Fetch User',
    execute: async (input) => {
      // input is: { userId }
      return { userName: 'Alice', email: 'alice@example.com' }
    },
  })
  .addStep<Preferences>({
    name: 'Load Preferences',
    execute: async (input) => {
      // input is: { userId, userName, email }
      return { theme: 'dark' }
    },
  })

// Execute
const result = await flow.execute({ userId: 'user-123' })

if (result.success) {
  // result.data has: { userId, userName, email, theme }
  console.log(result.data.userName) // 'Alice'
  console.log(result.data.theme) // 'dark'
}
```

## API Reference

### `createFlow<TInitial>(config)`

Creates a new sequential flow.

```typescript
const flow = createFlow<{ projectName: string }>({
  name: 'My Flow',
  analytics: customAnalytics, // Optional
  continueOnError: false, // Optional, default: false
})
```

### `flow.addStep<TOutput>(config)`

Adds a step to the flow. Returns a new flow with the enriched type.

```typescript
flow.addStep<OutputType>({
  name: 'Step Name',
  execute: async (input) => {
    // Process input and return new data
    return { /* new data */ };
  },
  shouldRun: (ctx) => boolean | Promise<boolean>,  // Optional
  onSuccess: (output, accumulated) => void,         // Optional
  onFailure: (error, input) => void,               // Optional
  retries: 2,                                       // Optional, default: 0
  timeout: 5000,                                    // Optional, in ms
});
```

### `flow.execute(initialInput)`

Executes the flow with the given initial input.

```typescript
const result = await flow.execute({ projectName: 'my-app' })

if (result.success) {
  console.log(result.data) // Fully typed accumulated data
} else {
  console.error(result.error)
}
```

### Analytics Interface

Implement `AnalyticsCollector` to track execution:

```typescript
const analytics: AnalyticsCollector = {
  onStepStart: (stepName, input) => {},
  onStepComplete: (stepName, result, duration) => {},
  onStepSkipped: (stepName, reason) => {},
  onFlowComplete: (flowName, totalDuration) => {},
  onFlowError: (flowName, error) => {},
}
```

## Examples

### Build Pipeline

See `src/examples/build-pipeline.ts` for a comprehensive example showing:

- Data enrichment through lint → compile → bundle → test → deploy
- Conditional execution (skip deploy if tests fail)
- Custom analytics tracking
- Error handling

Run it:

```bash
npm run example:pipeline
```

### Simple Example

See `src/examples/simple.ts` for a minimal example.

```bash
npm run example:simple
```

## How Data Enrichment Works

Each step receives the accumulated data from all previous steps and returns new data that gets merged:

```
Initial: { userId: '123' }
    ↓
Step 1 adds: { userName: 'Alice' }
    ↓
Accumulated: { userId: '123', userName: 'Alice' }
    ↓
Step 2 adds: { email: 'alice@example.com' }
    ↓
Accumulated: { userId: '123', userName: 'Alice', email: 'alice@example.com' }
```

TypeScript tracks this automatically, so you get full autocompletion and type checking.

## License

MIT
