---
sidebar_position: 13
title: Example Component Proposal
---

# Component Proposal: Metrics Aggregation Engine

> **Status**: Example Proposal (for demonstration purposes)
> **Author**: SLAOps Team
> **Date**: 2024-11-16
> **Related Issue**: N/A

## Overview

### Purpose
A real-time metrics aggregation engine that processes SLAOps log events and computes rolling statistics (latency percentiles, error rates, throughput) for API endpoints.

### Problem Statement
Currently, the SLAOps platform stores raw HTTP request/response logs, but users must manually query and aggregate these logs to understand API performance trends. This is inefficient for:
- Real-time dashboards that need instant metrics
- Alert systems that monitor SLA thresholds
- Cost analysis that requires aggregated usage patterns

Without automatic aggregation, users experience:
- High latency when computing metrics (querying millions of raw logs)
- Increased database load from repeated aggregation queries
- Delayed detection of SLA violations
- Inability to show real-time dashboards

### Scope
**In Scope:**
- Real-time aggregation of HTTP logs as they arrive
- Computation of p50, p95, p99 latency percentiles
- Error rate calculation (4xx, 5xx responses)
- Request throughput tracking (requests per minute/hour)
- Time-window bucketing (1min, 5min, 1hour, 1day)
- Per-endpoint granularity
- Cost accumulation per endpoint

**Out of Scope:**
- Historical backfill of existing logs (future enhancement)
- Custom metrics beyond HTTP performance
- Real-time alerting (separate component)
- Long-term metric storage optimization (use existing DB)

### Relationship to Existing Components
This component sits between the log ingestion pipeline and the dashboard/API layer, consuming events from `@slaops/client` connectors and providing aggregated data to the portal.

```mermaid
graph TD
    A[Client Apps] --> B[@slaops/client-*]
    B --> C[Log Ingestion API]
    C --> D[Raw Logs Database]
    C --> E[Metrics Aggregator]
    E --> F[Aggregated Metrics DB]
    F --> G[SLAOps Portal Dashboard]
    F --> H[Alerts Engine]

    style E fill:#ff6b6b,stroke:#333,stroke-width:3px
```

## Type Definitions

### Core Types

```typescript
/**
 * Configuration for the metrics aggregator
 */
export type AggregatorConfig = {
  /** Database connection for reading logs */
  logDatabaseUrl: string;

  /** Database connection for writing metrics */
  metricsDatabaseUrl: string;

  /** Time windows to aggregate over */
  timeWindows: TimeWindow[];

  /** Batch size for processing logs */
  batchSize?: number;

  /** Processing interval in milliseconds */
  processingInterval?: number;
}

/**
 * Time window for metric aggregation
 */
export type TimeWindow = '1min' | '5min' | '15min' | '1hour' | '1day';

/**
 * Aggregated metrics for a specific endpoint and time window
 */
export interface EndpointMetrics {
  /** Endpoint identifier */
  endpoint: string;

  /** HTTP method */
  method: string;

  /** Time window bucket */
  timeWindow: TimeWindow;

  /** Bucket start timestamp */
  timestamp: string;

  /** Request statistics */
  requests: {
    /** Total request count */
    total: number;

    /** Successful requests (2xx) */
    success: number;

    /** Client errors (4xx) */
    clientErrors: number;

    /** Server errors (5xx) */
    serverErrors: number;
  };

  /** Latency statistics in milliseconds */
  latency: {
    /** 50th percentile */
    p50: number;

    /** 95th percentile */
    p95: number;

    /** 99th percentile */
    p99: number;

    /** Minimum latency */
    min: number;

    /** Maximum latency */
    max: number;

    /** Average latency */
    avg: number;
  };

  /** Throughput in requests per minute */
  throughput: number;

  /** Error rate percentage (0-100) */
  errorRate: number;

  /** Total cost accumulated for this window */
  totalCost?: number;
}

/**
 * Input log event from raw logs database
 */
export type LogEvent = {
  /** Unique log ID */
  id: string;

  /** Timestamp of the request */
  timestamp: string;

  /** HTTP method */
  method: string;

  /** Request URL/endpoint */
  url: string;

  /** Response status code */
  statusCode: number;

  /** Request duration in milliseconds */
  duration: number;

  /** Optional cost associated with request */
  cost?: number;

  /** Project ID */
  projectId: string;
}

/**
 * Aggregation result returned by the engine
 */
export type AggregationResult = {
  /** Number of logs processed */
  processedCount: number;

  /** Number of metric records created/updated */
  metricsWritten: number;

  /** Processing duration in milliseconds */
  duration: number;

  /** Timestamp of latest processed log */
  latestTimestamp: string;

  /** Any errors encountered */
  errors?: string[];
}
```

### Input/Output Types

| Type | Purpose | Required | Default |
|------|---------|----------|---------|
| `AggregatorConfig` | Configuration for the engine | Yes | N/A |
| `LogEvent` | Raw log input from database | N/A (input) | N/A |
| `EndpointMetrics` | Computed metrics output | N/A (output) | N/A |
| `AggregationResult` | Processing result summary | N/A (return type) | N/A |

## Architecture

### Component Diagram

```mermaid
graph TB
    subgraph "Metrics Aggregator Engine"
        Poller[Log Event Poller]
        Batcher[Event Batcher]
        Computer[Metrics Compute]
        Writer[Metrics Writer]
        Cache[In-Memory Cache]

        Poller --> Batcher
        Batcher --> Computer
        Computer --> Cache
        Cache --> Writer
    end

    LogDB[(Raw Logs DB)] --> Poller
    Writer --> MetricsDB[(Metrics DB)]

    Monitor[Monitoring/Logging] -.-> Poller
    Monitor -.-> Computer
    Monitor -.-> Writer
```

### Data Flow

```mermaid
sequenceDiagram
    participant Timer
    participant Aggregator
    participant LogDB
    participant Computer
    participant Cache
    participant MetricsDB

    Timer->>Aggregator: trigger (every 1min)
    Aggregator->>LogDB: fetch new logs (last processed)
    LogDB-->>Aggregator: LogEvent[]

    Aggregator->>Computer: computeMetrics(events)
    Computer->>Cache: get existing metrics
    Cache-->>Computer: cached metrics
    Computer->>Computer: aggregate (percentiles, rates)
    Computer-->>Aggregator: EndpointMetrics[]

    Aggregator->>MetricsDB: upsert metrics
    MetricsDB-->>Aggregator: success
    Aggregator->>Cache: update cache
    Aggregator-->>Timer: AggregationResult
```

### Integration Points

| Integration Point | Component | Direction | Protocol |
|-------------------|-----------|-----------|----------|
| Log Input | Supabase (raw_logs table) | Inbound | PostgreSQL query |
| Metrics Output | Supabase (metrics table) | Outbound | PostgreSQL upsert |
| Cache | In-memory (Node.js Map) | Internal | Direct access |
| Monitoring | OpenTelemetry | Outbound | OTLP |
| Configuration | Environment variables | Inbound | Process env |

## API Specification

### Exported Classes

```typescript
/**
 * Main metrics aggregation engine
 */
export class MetricsAggregator {
  constructor(config: AggregatorConfig);

  /**
   * Start the aggregation engine
   * Begins polling and processing logs at configured interval
   * @returns Promise that resolves when engine is running
   */
  start(): Promise<void>;

  /**
   * Stop the aggregation engine
   * Waits for current processing to complete
   * @returns Promise that resolves when engine is stopped
   */
  stop(): Promise<void>;

  /**
   * Process a single batch manually (for testing)
   * @param fromTimestamp - Start timestamp for log fetch
   * @returns Aggregation result
   */
  processBatch(fromTimestamp: string): Promise<AggregationResult>;

  /**
   * Get current engine status
   * @returns Engine status information
   */
  getStatus(): EngineStatus;
}

/**
 * Engine status information
 */
export type EngineStatus = {
  /** Is the engine currently running */
  running: boolean;

  /** Timestamp of last successful processing */
  lastProcessedAt?: string;

  /** Total logs processed since start */
  totalLogsProcessed: number;

  /** Total metrics written since start */
  totalMetricsWritten: number;

  /** Current processing lag (now - latest log timestamp) */
  processingLag?: number;
}
```

### Exported Functions

```typescript
/**
 * Compute metrics for a batch of log events
 * Pure function for testing and reuse
 * @param events - Array of log events
 * @param timeWindow - Time window for bucketing
 * @returns Computed metrics grouped by endpoint
 */
export function computeMetrics(
  events: LogEvent[],
  timeWindow: TimeWindow
): Map<string, EndpointMetrics>;

/**
 * Calculate percentile from sorted array of values
 * @param values - Sorted numeric array
 * @param percentile - Percentile to calculate (0-100)
 * @returns Percentile value
 */
export function calculatePercentile(
  values: number[],
  percentile: number
): number;

/**
 * Bucket timestamp into time window
 * @param timestamp - ISO timestamp string
 * @param timeWindow - Window size
 * @returns Bucket start timestamp
 */
export function bucketTimestamp(
  timestamp: string,
  timeWindow: TimeWindow
): string;
```

### Usage Examples

#### Basic Usage

```typescript
import { MetricsAggregator } from '@slaops/metrics-aggregator';

// Create and start aggregator
const aggregator = new MetricsAggregator({
  logDatabaseUrl: process.env.LOG_DB_URL!,
  metricsDatabaseUrl: process.env.METRICS_DB_URL!,
  timeWindows: ['1min', '5min', '1hour'],
  batchSize: 1000,
  processingInterval: 60000, // 1 minute
});

await aggregator.start();
console.log('Metrics aggregator started');

// Later: stop gracefully
process.on('SIGTERM', async () => {
  await aggregator.stop();
  console.log('Metrics aggregator stopped');
});
```

#### Advanced Usage with Manual Processing

```typescript
import { MetricsAggregator } from '@slaops/metrics-aggregator';

const aggregator = new MetricsAggregator(config);

// Process a specific time range manually
const result = await aggregator.processBatch('2024-11-16T10:00:00Z');

console.log(`Processed ${result.processedCount} logs`);
console.log(`Wrote ${result.metricsWritten} metric records`);
console.log(`Processing took ${result.duration}ms`);

// Check engine status
const status = aggregator.getStatus();
if (status.processingLag && status.processingLag > 300000) {
  console.warn('Processing lag exceeds 5 minutes!');
}
```

#### Using Compute Function Directly

```typescript
import { computeMetrics, calculatePercentile } from '@slaops/metrics-aggregator';

// Process logs in custom way
const logs: LogEvent[] = await fetchLogsFromCustomSource();
const metrics = computeMetrics(logs, '5min');

for (const [endpoint, metric] of metrics) {
  console.log(`${endpoint}: p95=${metric.latency.p95}ms, errors=${metric.errorRate}%`);
}

// Calculate custom percentiles
const latencies = logs.map(l => l.duration).sort((a, b) => a - b);
const p99 = calculatePercentile(latencies, 99);
console.log(`P99 latency: ${p99}ms`);
```

## Data Structures

### Configuration Schema

```json
{
  "logDatabaseUrl": "postgresql://user:pass@host:5432/slaops_logs",
  "metricsDatabaseUrl": "postgresql://user:pass@host:5432/slaops_metrics",
  "timeWindows": ["1min", "5min", "1hour", "1day"],
  "batchSize": 1000,
  "processingInterval": 60000
}
```

### Log Event Schema (Input)

```json
{
  "id": "log_abc123",
  "timestamp": "2024-11-16T10:30:45.123Z",
  "method": "GET",
  "url": "/api/users/123",
  "statusCode": 200,
  "duration": 145,
  "cost": 0.0001,
  "projectId": "proj_xyz"
}
```

### Endpoint Metrics Schema (Output)

```json
{
  "endpoint": "/api/users/:id",
  "method": "GET",
  "timeWindow": "5min",
  "timestamp": "2024-11-16T10:30:00.000Z",
  "requests": {
    "total": 1250,
    "success": 1200,
    "clientErrors": 30,
    "serverErrors": 20
  },
  "latency": {
    "p50": 120,
    "p95": 450,
    "p99": 890,
    "min": 45,
    "max": 2100,
    "avg": 156
  },
  "throughput": 250,
  "errorRate": 4.0,
  "totalCost": 0.125
}
```

### Field Specifications

#### AggregatorConfig Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `logDatabaseUrl` | string | Yes | PostgreSQL connection URL for logs | Valid URL, postgres:// protocol |
| `metricsDatabaseUrl` | string | Yes | PostgreSQL connection URL for metrics | Valid URL, postgres:// protocol |
| `timeWindows` | TimeWindow[] | Yes | Time windows to compute | Non-empty array |
| `batchSize` | number | No | Logs per processing batch | &gt; 0, &lt;= 10000, default: 1000 |
| `processingInterval` | number | No | Milliseconds between runs | &gt;= 10000, default: 60000 |

#### EndpointMetrics Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `endpoint` | string | Yes | Normalized endpoint path | Non-empty |
| `method` | string | Yes | HTTP method | GET, POST, PUT, DELETE, PATCH |
| `timeWindow` | TimeWindow | Yes | Aggregation window | Valid TimeWindow enum |
| `timestamp` | string | Yes | Bucket start time | ISO 8601 timestamp |
| `requests.total` | number | Yes | Total request count | &gt;= 0 |
| `latency.p95` | number | Yes | 95th percentile latency | &gt;= 0 |
| `throughput` | number | Yes | Requests per minute | &gt;= 0 |
| `errorRate` | number | Yes | Error percentage | 0-100 |

## Dependencies

### Internal Dependencies

| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| `@slaops/core` | `*` | Core types | Yes |
| `@slaops/lib` | `*` | Shared utilities | Yes |

### External Dependencies

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| `@supabase/supabase-js` | `^2.38.0` | Database client | MIT |
| `date-fns` | `^3.0.0` | Date manipulation | MIT |
| `p-limit` | `^5.0.0` | Concurrency control | MIT |
| `opentelemetry` | `^1.17.0` | Observability | Apache 2.0 |

### Dependency Graph

```mermaid
graph TD
    Core[@slaops/core] --> Aggregator[@slaops/metrics-aggregator]
    Lib[@slaops/lib] --> Aggregator

    Supabase[supabase-js] --> Aggregator
    DateFns[date-fns] --> Aggregator
    PLimit[p-limit] --> Aggregator
    OTEL[opentelemetry] --> Aggregator
```

## Implementation Details

### Key Algorithms

#### Metrics Computation Algorithm

```text
FUNCTION computeMetrics(events: LogEvent[], timeWindow: TimeWindow):
  // Step 1: Group events by endpoint and bucket
  grouped = new Map<string, LogEvent[]>()

  FOR EACH event IN events:
    bucket = bucketTimestamp(event.timestamp, timeWindow)
    key = `${event.method}:${normalizeEndpoint(event.url)}:${bucket}`

    IF NOT grouped.has(key):
      grouped.set(key, [])

    grouped.get(key).push(event)

  // Step 2: Compute metrics for each group
  metrics = new Map<string, EndpointMetrics>()

  FOR EACH [key, eventGroup] IN grouped:
    [method, endpoint, timestamp] = parseKey(key)

    // Count requests by status
    total = eventGroup.length
    success = COUNT WHERE statusCode IN [200-299]
    clientErrors = COUNT WHERE statusCode IN [400-499]
    serverErrors = COUNT WHERE statusCode IN [500-599]

    // Compute latency percentiles
    durations = eventGroup.map(e => e.duration).sort()
    p50 = calculatePercentile(durations, 50)
    p95 = calculatePercentile(durations, 95)
    p99 = calculatePercentile(durations, 99)
    min = durations[0]
    max = durations[durations.length - 1]
    avg = SUM(durations) / total

    // Compute rates
    windowMinutes = getWindowMinutes(timeWindow)
    throughput = total / windowMinutes
    errorRate = ((clientErrors + serverErrors) / total) * 100

    // Compute cost
    totalCost = SUM(eventGroup.map(e => e.cost || 0))

    metrics.set(key, {
      endpoint,
      method,
      timeWindow,
      timestamp,
      requests: { total, success, clientErrors, serverErrors },
      latency: { p50, p95, p99, min, max, avg },
      throughput,
      errorRate,
      totalCost
    })

  RETURN metrics
```

#### Percentile Calculation Algorithm

```text
FUNCTION calculatePercentile(sortedValues: number[], percentile: number):
  IF sortedValues.length == 0:
    RETURN 0

  IF sortedValues.length == 1:
    RETURN sortedValues[0]

  // Use linear interpolation between closest ranks
  rank = (percentile / 100) * (sortedValues.length - 1)
  lowerIndex = FLOOR(rank)
  upperIndex = CEILING(rank)
  weight = rank - lowerIndex

  IF lowerIndex == upperIndex:
    RETURN sortedValues[lowerIndex]

  lowerValue = sortedValues[lowerIndex]
  upperValue = sortedValues[upperIndex]

  RETURN lowerValue + weight * (upperValue - lowerValue)
```

### Edge Cases

| Case | Condition | Handling | Expected Outcome |
|------|-----------|----------|------------------|
| No logs in window | `events.length === 0` | Skip processing | No metrics written |
| Single log | `events.length === 1` | All percentiles = duration | Valid metrics with p50=p95=p99 |
| All requests fail | All status codes >= 400 | Compute normally | `errorRate = 100` |
| Database unavailable | Connection error | Retry with exponential backoff | Log error, continue on recovery |
| Processing lag | Current time >> latest log | Log warning, continue | Warning in logs |
| Duplicate processing | Logs already processed | Upsert (overwrite) | Idempotent operation |
| Missing cost data | `cost === undefined` | Use 0 | `totalCost = 0` |
| Invalid timestamp | Cannot parse timestamp | Skip log, log error | Continue with valid logs |
| Extreme latency | duration > 60000ms | Include in p99, flag | Metrics show spike |

### Error Handling

```typescript
/**
 * Base error class for aggregator
 */
export class AggregatorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AggregatorError';
  }
}

// Error codes
export const ErrorCodes = {
  DATABASE_CONNECTION: 'DATABASE_CONNECTION',
  QUERY_FAILED: 'QUERY_FAILED',
  COMPUTATION_FAILED: 'COMPUTATION_FAILED',
  WRITE_FAILED: 'WRITE_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
} as const;

// Error handling in main loop
try {
  const result = await processBatch();
} catch (error) {
  if (error instanceof AggregatorError) {
    if (error.code === ErrorCodes.DATABASE_CONNECTION) {
      // Retry with backoff
      await retryWithBackoff(() => processBatch());
    } else {
      // Log and continue
      logger.error('Processing failed', { error });
    }
  } else {
    // Unexpected error
    logger.error('Unexpected error', { error });
  }
}
```

### Performance Considerations

- **Memory Usage**:
  - Batch processing limits memory to ~100MB for 1000-event batches
  - In-memory cache capped at 10,000 endpoint-window combinations (~50MB)

- **Database Load**:
  - Single query per batch to fetch logs (indexed by timestamp)
  - Bulk upsert for metrics (one query for all metrics in batch)
  - Connection pooling (max 10 connections)

- **Processing Latency**:
  - Target: Process 1000 logs in < 500ms
  - Percentile calculation: O(n log n) due to sorting
  - Grouping: O(n) hash map operations

- **Throughput**:
  - Target: 1000 logs per second sustained
  - Batch size tunable based on log volume
  - Parallel processing for multiple time windows

- **Scalability**:
  - Horizontal: Multiple aggregator instances with time-based sharding
  - Vertical: Increase batch size and processing interval

## Integration Guide

### Installation

```bash
# Using pnpm (recommended for monorepo)
pnpm --filter @slaops/metrics-aggregator add @slaops/metrics-aggregator

# Or install as a standalone service
pnpm add @slaops/metrics-aggregator
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logDatabaseUrl` | string | (required) | PostgreSQL connection URL for raw logs |
| `metricsDatabaseUrl` | string | (required) | PostgreSQL connection URL for metrics |
| `timeWindows` | TimeWindow[] | `['1min', '5min', '1hour']` | Time windows to compute |
| `batchSize` | number | `1000` | Number of logs to process per batch |
| `processingInterval` | number | `60000` | Milliseconds between processing runs |
| `maxRetries` | number | `3` | Max retry attempts for failed operations |
| `retryBackoff` | number | `1000` | Initial backoff for retries (ms) |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `METRICS_LOG_DB_URL` | Yes | N/A | Log database connection URL |
| `METRICS_METRICS_DB_URL` | Yes | N/A | Metrics database connection URL |
| `METRICS_TIME_WINDOWS` | No | `'1min,5min,1hour'` | Comma-separated time windows |
| `METRICS_BATCH_SIZE` | No | `1000` | Batch size for processing |
| `METRICS_INTERVAL` | No | `60000` | Processing interval in ms |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | N/A | OpenTelemetry endpoint |

### Database Schema Setup

#### Required Tables

**metrics table**:
```sql
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  time_window TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  requests JSONB NOT NULL,
  latency JSONB NOT NULL,
  throughput NUMERIC NOT NULL,
  error_rate NUMERIC NOT NULL,
  total_cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for upserts
  UNIQUE(endpoint, method, time_window, timestamp)
);

-- Indexes for query performance
CREATE INDEX idx_metrics_endpoint ON metrics(endpoint);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp DESC);
CREATE INDEX idx_metrics_lookup ON metrics(endpoint, method, time_window, timestamp);
```

**Requires access to existing raw_logs table**:
```sql
-- Ensure index exists for efficient querying
CREATE INDEX IF NOT EXISTS idx_raw_logs_timestamp
  ON raw_logs(timestamp DESC);
```

### Deployment

#### Standalone Service

```typescript
// server.ts
import { MetricsAggregator } from '@slaops/metrics-aggregator';

const aggregator = new MetricsAggregator({
  logDatabaseUrl: process.env.METRICS_LOG_DB_URL!,
  metricsDatabaseUrl: process.env.METRICS_METRICS_DB_URL!,
  timeWindows: (process.env.METRICS_TIME_WINDOWS || '1min,5min,1hour')
    .split(',') as TimeWindow[],
  batchSize: parseInt(process.env.METRICS_BATCH_SIZE || '1000'),
  processingInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
});

async function main() {
  console.log('Starting metrics aggregator...');
  await aggregator.start();
  console.log('Metrics aggregator running');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Stopping metrics aggregator...');
    await aggregator.stop();
    console.log('Stopped');
    process.exit(0);
  });
}

main().catch(console.error);
```

#### Docker Deployment

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

CMD ["node", "dist/server.js"]
```

## Testing Strategy

### Unit Tests

| Test Case | Input | Expected Output | Priority |
|-----------|-------|-----------------|----------|
| Compute metrics for single endpoint | 100 logs, same endpoint | 1 metric with correct stats | High |
| Calculate p95 percentile | [10, 20, 30, ... 100] | 95 | High |
| Bucket timestamp to 5min | '2024-11-16T10:32:45Z' | '2024-11-16T10:30:00Z' | High |
| Handle empty log array | [] | Empty metrics map | High |
| Handle single log | [1 log] | Metric with p50=p95=p99=duration | High |
| Normalize endpoints | '/api/users/123' | '/api/users/:id' | Medium |
| Group by method | GET and POST to same URL | 2 separate metrics | Medium |
| Compute error rate | 80 success, 20 errors | errorRate = 20 | High |
| Sum costs | Logs with cost values | Total cost sum | Medium |
| Handle missing cost | Logs without cost field | totalCost = 0 | Low |

### Integration Tests

1. **Database Integration**
   - Fetch logs from real database
   - Write metrics to real database
   - Verify upsert behavior (duplicate writes)

2. **End-to-End Processing**
   - Insert test logs into log database
   - Run aggregator
   - Query metrics database
   - Verify computed metrics match expected

3. **Error Recovery**
   - Simulate database disconnection
   - Verify retry behavior
   - Verify no data loss

4. **Multiple Time Windows**
   - Process logs for 1min, 5min, 1hour
   - Verify all windows have metrics

### Performance Tests

- **Throughput**: Process 10,000 logs in < 5 seconds
- **Memory**: Peak memory < 200MB for 5000 log batch
- **Database**: Query time < 100ms for log fetch
- **Computation**: Metric computation < 200ms for 1000 logs

### Test Coverage Target

- **Unit tests**: 95%+ coverage (core computation logic)
- **Integration tests**: All database operations
- **E2E tests**: Full processing cycle (logs → metrics)
- **Performance tests**: Batch processing benchmarks

## Build Configuration

### Package Configuration

```json
{
  "name": "@slaops/metrics-aggregator",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --clean",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "@slaops/core": "*",
    "@slaops/lib": "*",
    "@supabase/supabase-js": "^2.38.0",
    "date-fns": "^3.0.0",
    "p-limit": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.6.3",
    "vitest": "^1.0.0"
  }
}
```

### Build Script

```bash
# Build with tsup (fast TypeScript bundler)
tsup src/index.ts --format esm,cjs --dts --clean
```

### Build Order

This package depends on core and lib, so build order is:

```mermaid
graph LR
    A[@slaops/core] --> C[@slaops/metrics-aggregator]
    B[@slaops/lib] --> C
```

Build command:
```bash
pnpm --filter @slaops/core run build &&
pnpm --filter @slaops/lib run build &&
pnpm --filter @slaops/metrics-aggregator run build
```

## Documentation Requirements

### Required Documentation

- [x] README.md with quickstart guide
- [x] API reference (this proposal serves as spec)
- [ ] Usage examples in docs site (`docs/metrics-aggregator.md`)
- [ ] Deployment guide
- [ ] Database schema documentation
- [ ] CHANGELOG.md

### Code Documentation

- [ ] TSDoc comments on all exported types
- [ ] TSDoc comments on all public methods
- [ ] Inline comments for percentile algorithm
- [ ] Usage examples in JSDoc
- [ ] Error handling documentation

## Rollout Plan

### Phase 1: Development (Week 1-2)
- [x] Design proposal (this document)
- [ ] Implement core computation logic
- [ ] Write unit tests for algorithms
- [ ] Database schema creation
- [ ] Internal code review

### Phase 2: Testing (Week 3)
- [ ] Integration tests with real database
- [ ] Performance benchmarking
- [ ] End-to-end testing with sample data
- [ ] Documentation review

### Phase 3: Beta (Week 4)
- [ ] Deploy to staging environment
- [ ] Process staging logs
- [ ] Validate metrics accuracy
- [ ] Monitor performance and resource usage
- [ ] Gather feedback from team

### Phase 4: Production (Week 5)
- [ ] Production deployment
- [ ] Start with 1min and 5min windows only
- [ ] Monitor for 1 week
- [ ] Add remaining time windows
- [ ] Update portal to consume metrics

### Phase 5: Optimization (Week 6+)
- [ ] Historical backfill capability
- [ ] Custom metric definitions
- [ ] Advanced aggregations (cost by user, etc.)
- [ ] Performance tuning based on production data

## Open Questions

- [x] **Q1: Should we support custom time windows?**
  **Decision**: Start with fixed windows, add custom in v2 if needed

- [ ] **Q2: How should we handle endpoint normalization?**
  **Options**:
  - Use OpenAPI spec to determine path params
  - Pattern matching (e.g., numeric IDs)
  - User-defined rules

- [ ] **Q3: Should metrics be computed in real-time or batch?**
  **Current**: Batch every 1 minute
  **Alternative**: Stream processing for real-time metrics

- [ ] **Q4: How long should we retain aggregated metrics?**
  **Proposal**:
  - 1min windows: 7 days
  - 5min windows: 30 days
  - 1hour windows: 90 days
  - 1day windows: 1 year

## Alternatives Considered

### Alternative 1: Stream Processing with Kafka
**Pros:**
- Real-time metrics (sub-second latency)
- Better scalability for high volume
- Event replay capability

**Cons:**
- Increased infrastructure complexity
- Higher operational costs
- Requires Kafka cluster management
- Over-engineered for current scale (&lt;1M requests/day)

**Why not chosen**: Current batch approach is simpler and sufficient for current scale. Can migrate to streaming later if needed.

### Alternative 2: Pre-aggregated Metrics in Client
**Pros:**
- No server-side processing needed
- Lower backend load
- Instant availability

**Cons:**
- Clients must implement aggregation logic
- Inconsistent metric computation across clients
- Can't retroactively change aggregation logic
- No protection against malicious clients

**Why not chosen**: Centralized aggregation ensures consistency and allows us to change logic without client updates.

### Alternative 3: Time-series Database (TimescaleDB/InfluxDB)
**Pros:**
- Optimized for time-series data
- Built-in downsampling and retention policies
- Better query performance for time-range queries

**Cons:**
- Additional database to manage
- Need to migrate existing data
- Team learning curve
- Increased infrastructure complexity

**Why not chosen**: PostgreSQL with proper indexing is sufficient for current needs. Can migrate to TimescaleDB extension if needed (minimal migration).

## References

- [Percentile Calculation Methods](https://en.wikipedia.org/wiki/Percentile)
- [Time-series Data Best Practices](https://www.timescale.com/blog/time-series-data-why-and-how-to-use-a-relational-database-instead-of-nosql-d0cd6975e87c/)
- [OpenTelemetry Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

## Approval

- [ ] Technical Lead: _______________
- [ ] Architect: _______________
- [ ] Product Owner: _______________
- [ ] Date Approved: _______________

---

**Template Version**: 1.0
**Last Updated**: 2024-11-16
**Status**: Example for demonstration purposes
