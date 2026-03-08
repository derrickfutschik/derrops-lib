import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { TEST_API_SPECS } from '../../../../test-resources/loader'
import { buildOperationIndex } from '../../src/openapi/openapi-indexer'
import { loadSpec } from '../../src/openapi/openapi-parser'
import { IndexedOperationDoc } from '../../src/openapi/openapi-types'
import { DynamoDBRepo } from '../../src/openapi/repo/dynamodb-repo'

describe('Operation Indexer', () => {
  const client = new DynamoDBClient({
    endpoint: 'http://192.168.7.223:4566',
    region: 'us-east-1',
  })

  const repo = new DynamoDBRepo<IndexedOperationDoc>({
    client,
    tableName: 'operation-index',
    partitionKeyName: 'operation_id',
  })

  beforeEach(async () => {
    if (!(await repo.tableExists())) {
      return repo.createTable()
    }
  })

  afterAll(async () => {
    // Clean up the DynamoDB client to prevent open handles
    client.destroy()
  })

  test('buildOperationIndex', async () => {
    const specPaths = Object.values(TEST_API_SPECS).map((path) => path())
    const totalPaths = await Promise.all(
      specPaths.map(async (specPath) => {
        const spec = await loadSpec(specPath)
        const createdOperations = await buildOperationIndex(spec, repo)
        return createdOperations
      }),
    )
    console.log({ totalPaths })

    // Verify that operations were created
    expect(totalPaths.length).toBeGreaterThan(0)
    expect(totalPaths.every((count) => count > 0)).toBe(true)
  }, 30000) // 30 second timeout for integration test with DynamoDB
})
