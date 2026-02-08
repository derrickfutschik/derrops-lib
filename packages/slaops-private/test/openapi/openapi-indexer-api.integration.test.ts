import * as dynamodb from '@aws-sdk/client-dynamodb'
import { TEST_API_SPECS } from '../../../../test-resources/loader'
import { buildAPIIndex } from '../../src/openapi/openapi-indexer'
import { loadSpec, loadSpecSync } from '../../src/openapi/openapi-parser'
import { IndexedServerDoc } from '../../src/openapi/openapi-types'
import { DynamoDBRepo } from '../../src/openapi/repo/dynamodb-repo'

describe('API Indexer', () => {
  // jest.setTimeout(30000);

  const client = new dynamodb.DynamoDBClient({
    endpoint: 'http://192.168.7.224:4566',
    region: 'us-east-1',
  })

  const tableName = 'server-index'
  const partitionKeyName = 'host_template'

  const repo = new DynamoDBRepo<IndexedServerDoc>({
    client,
    tableName,
    partitionKeyName,
  })

  beforeEach(async () => {
    if (!(await repo.tableExists())) {
      return repo.createTable()
    }
  })

  test('list tables', async () => {
    const tables = await client.send(new dynamodb.ListTablesCommand({}))
    console.log({ tables })
  })

  test('buildAPIIndexAsync', async () => {
    const specPaths = Object.values(TEST_API_SPECS).map((path) => path())
    const totalPaths = await Promise.all(
      specPaths.map(async (specPath) => {
        const spec = await loadSpec(specPath)
        const createdServers = await buildAPIIndex(spec, repo)
        return createdServers
      }),
    )
    console.log(totalPaths)
  })

  test('buildAPIIndexSync', async () => {
    const specPaths = Object.values(TEST_API_SPECS).map((path) => path())
    const totalPaths = await Promise.all(
      specPaths.map(async (specPath) => {
        const spec = loadSpecSync(specPath)
        const createdServers = buildAPIIndex(spec, repo)
        return createdServers
      }),
    )
    console.log(totalPaths)
  })
})
