/**
 * Integration test for OpenApiIndexerService.indexDocument
 * Uses TEST_API_SPECS.ably and a mocked OpenSearch client.
 */

import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Client } from '@opensearch-project/opensearch'
import { loadConfig, resetConfigForTests, setConfigForProcess } from '@slaops/config'
import testEnv from '@slaops/config/src/test-env'
import { existsSync, readFileSync } from 'node:fs'
import { TypescriptOSProxyClient } from 'opensearch-ts'
import { TEST_API_SPECS } from '../../../../test-resources/loader'
import { OpenApiIndexerService } from './openapi-indexer.service'
import { OpenApiParserService } from './openapi-parser.service'

const ABLY_DOCUMENT_ID = 'ably.net/control/v1'
const ABLY_S3_KEY = 'APIs/ably.net/control/v1/openapi.yaml'
const ABLY_BUCKET = 'test-openapis'

describe('OpenApiIndexerService (integration)', () => {
  let indexerService: OpenApiIndexerService
  let parserService: OpenApiParserService
  let mockIndex: jest.Mock

  beforeAll(() => {
    const env = loadConfig(testEnv)
    setConfigForProcess(env)
  })

  afterAll(() => {
    resetConfigForTests()
  })

  beforeEach(async () => {
    mockIndex = jest.fn().mockResolvedValue({ body: { result: 'created', _id: ABLY_DOCUMENT_ID } })

    const mockClient = {
      index: mockIndex,
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as Client

    const mockTsClient = {} as TypescriptOSProxyClient

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        OpenApiIndexerService,
        OpenApiParserService,
        { provide: Client, useValue: mockClient },
        { provide: TypescriptOSProxyClient, useValue: mockTsClient },
      ],
    }).compile()

    indexerService = moduleRef.get(OpenApiIndexerService)
    parserService = moduleRef.get(OpenApiParserService)
  })

  it('indexDocument indexes the Ably spec document and calls OpenSearch with the expected payload', async () => {
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

    await indexerService.indexDocument(ABLY_DOCUMENT_ID, document)

    expect(mockIndex).toHaveBeenCalledTimes(1)
    const [call] = mockIndex.mock.calls
    expect(call[0]).toMatchObject({
      index: expect.any(String),
      id: ABLY_DOCUMENT_ID,
      refresh: true,
    })
    expect(call[0].body).toBeDefined()
    const body = call[0].body as Record<string, unknown>
    expect(body.id).toBe(ABLY_DOCUMENT_ID)
    expect(body.provider).toBe('ably.net')
    expect(body.serviceName).toBe('control')
    expect(body.version).toBe('v1')
    expect(body.title).toBe(document.title)
    expect(body.operationStats).toEqual(document.operationStats)
    expect(body.s3Location).toEqual({ bucket: ABLY_BUCKET, key: ABLY_S3_KEY })
  })
})
