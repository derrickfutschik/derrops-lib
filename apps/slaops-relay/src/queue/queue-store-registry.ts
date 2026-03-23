import type { QueueStore } from './queue-store'
import { QueueStoreError } from './queue-store'
import { InMemoryQueueStore } from './in-memory-queue-store'
import { env } from '../env'

export type QueueStoreFactory = (environment: NodeJS.ProcessEnv) => QueueStore

/**
 * Registry of available QueueStore implementations.
 * Built-in backends are pre-registered. Custom implementations can be
 * registered before bootstrap() via queueStoreRegistry.register().
 *
 * Active backend is selected by RELAY_QUEUE_BACKEND (default: 'memory').
 * Available built-in backends:
 *   memory  — in-process Map, zero dependencies (default)
 *   sqs     — AWS SQS + DynamoDB (requires @aws-sdk/client-sqs, @aws-sdk/lib-dynamodb)
 */
export class QueueStoreRegistry {
  private readonly factories = new Map<string, QueueStoreFactory>()

  register(name: string, factory: QueueStoreFactory): void {
    if (this.factories.has(name)) {
      throw new QueueStoreError(
        `QueueStore backend '${name}' is already registered`,
        'STORE_UNAVAILABLE',
      )
    }
    this.factories.set(name, factory)
  }

  create(environment: NodeJS.ProcessEnv = process.env): QueueStore {
    const backendName = env.queue.backend
    const factory = this.factories.get(backendName)
    if (!factory) {
      throw new QueueStoreError(
        `QueueStore backend '${backendName}' is not registered. ` +
          `Available: ${[...this.factories.keys()].join(', ')}`,
        'STORE_UNAVAILABLE',
      )
    }
    return factory(environment)
  }
}

export const queueStoreRegistry = new QueueStoreRegistry()

// Register built-in backends
queueStoreRegistry.register('memory', () => new InMemoryQueueStore())
queueStoreRegistry.register('sqs', envArg => {
  // SqsQueueStore uses dynamic imports internally for the AWS SDKs so the
  // relay doesn't fail to start when those packages aren't installed.
  const { SqsQueueStore } = require('./sqs-queue-store') as typeof import('./sqs-queue-store')
  return new SqsQueueStore(envArg)
})
