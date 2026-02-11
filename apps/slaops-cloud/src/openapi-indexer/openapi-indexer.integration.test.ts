/**
 * Integration test for OpenApiIndexerService.indexDocument
 * Uses TEST_API_SPECS.ably and a real OpenSearch client.
 * Requires OpenSearch to be available at OPENSEARCH_ENDPOINT.
 */
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Client } from '@opensearch-project/opensearch'
import { config, loadConfig, resetConfigForTests, setConfigForProcess } from '@slaops/config'

import { existsSync, readFileSync } from 'node:fs'
import { TEST_API_SPECS } from '../../../../test-resources/loader'
import { OpenApiIndexerModule } from './openapi-indexer.module'
import { OpenApiIndexerService } from './openapi-indexer.service'
import { OpenApiParserService } from './openapi-parser.service'
import devEnv from '@slaops/config/dev-env'
// import testEnv from '@slaops/config/test-env'

const ABLY_DOCUMENT_ID = 'c57b6076698b15a556a609c44e99ac7f'
const ABLY_S3_KEY = 'APIs/ably.net/control/v1/openapi.yaml'
const ABLY_BUCKET = 'test-openapis'

describe('OpenApiIndexerService (integration)', () => {
  let indexerService: OpenApiIndexerService
  let parserService: OpenApiParserService
  let opensearchClient: Client

  beforeAll(() => {
    // const env = loadConfig(testEnv)
    const env = loadConfig(testEnv)
    setConfigForProcess(env)
  })

  afterAll(() => {
    resetConfigForTests()
  })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), OpenApiIndexerModule],
    }).compile()

    indexerService = moduleRef.get(OpenApiIndexerService)
    parserService = moduleRef.get(OpenApiParserService)
    opensearchClient = moduleRef.get(Client)
  })

  it('indexDocument indexes the Ably spec document in OpenSearch', async () => {
    const specPath = TEST_API_SPECS.ably()
    expect(existsSync(specPath)).toBe(true)

    const content = readFileSync(specPath, 'utf-8')
    const { document } = parserService.parseAndTransform(content, ABLY_S3_KEY, ABLY_BUCKET)

    expect(document).toBeDefined()
    expect(document.id).toBe(ABLY_DOCUMENT_ID)
    expect(document.provider).toBe('ably.net')
    expect(document.serviceName).toBe('control')
    expect(document.version).toBe('v1')
    expect(document.title).toBeDefined()
    expect(document.operationStats.total).toBeGreaterThan(0)
    expect(document.paths.length).toBeGreaterThan(0)

    const indexedResponse = await indexerService.indexDocument(ABLY_DOCUMENT_ID, document)
    console.log(JSON.stringify(indexedResponse, null, 2))

    const { body } = await opensearchClient.get({
      index: config['opensearch.index.openapi.apis'],
      id: ABLY_DOCUMENT_ID,
    })

    console.log({
      index: config['opensearch.index.openapi.apis'],
      id: ABLY_DOCUMENT_ID,
    })
    console.log(body)

    console.log(config)

    const indexed = body._source as Record<string, unknown>
    expect(indexed.id).toBe(ABLY_DOCUMENT_ID)
    expect(indexed.provider).toBe('ably.net')
    expect(indexed.serviceName).toBe('control')
    expect(indexed.version).toBe('v1')
    expect(indexed.title).toBe(document.title)
    expect(indexed.operationStats).toEqual(document.operationStats)
    expect(indexed.s3Location).toEqual({ bucket: ABLY_BUCKET, key: ABLY_S3_KEY })

    await indexerService.deleteDocument(ABLY_DOCUMENT_ID)
  })
})
