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
import { resolveSpec, TEST_API_SPECS } from '../../../../test-resources/loader'
import { OpenApiIndexerModule } from './openapi-indexer.module'
import { OpenApiIndexerService } from './openapi-indexer.service'
import { OpenApiParserService } from './openapi-parser.service'

import testEnv from '@slaops/config/test-env'

const API_ID = 'c57b6076698b15a556a609c44e99ac7f'
const API_YAML = 'APIs/ably.net/control/v1/openapi.yaml'
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
    const specPath = resolveSpec('ably.net', 'control')
    console.log({ specPath })
    expect(existsSync(specPath)).toBe(true)

    const content = readFileSync(specPath, 'utf-8')
    const { document } = parserService.parseAndTransform(content, API_YAML, ABLY_BUCKET)

    expect(document).toMatchObject({
      id: API_ID,
      provider: 'ably.net',
      serviceName: 'control',
      version: 'v1',
      title: document.title,
      operationStats: expect.objectContaining({ total: expect.any(Number) }),
      paths: expect.any(Array),
    })
    expect(document.operationStats.total).toBeGreaterThan(0)
    expect(document.paths.length).toBeGreaterThan(0)

    const indexedResponse = await indexerService.indexDocument(document)

    const { body } = await opensearchClient.get({
      index: config['opensearch.index.openapi.apis'],
      id: API_ID,
    })

    const indexed = body._source as Record<string, unknown>
    expect(indexed).toMatchObject({
      id: API_ID,
      provider: 'ably.net',
      serviceName: 'control',
      version: 'v1',
      title: document.title,
      operationStats: document.operationStats,
      s3Location: { bucket: ABLY_BUCKET, key: API_YAML },
    })

    // TODO make a test for then searching the documents
  })
})
