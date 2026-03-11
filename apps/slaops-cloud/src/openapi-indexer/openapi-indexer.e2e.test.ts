/**
 * End-to-end test for the OpenAPI Indexer upload flow.
 *
 * Flow under test:
 *   1. Generate a pre-signed PUT URL for the staging bucket
 *   2. Upload the Ably control API spec to staging via the pre-signed URL
 *   3. Trigger processFromStaging → validates, saves to storage, indexes into OpenSearch
 *   4. Assert the document is present in OpenSearch
 *   5. Assert the raw spec is stored in the storage bucket
 *
 * Requires:
 *   - A running MinIO (or real AWS S3) accessible at config['aws.s3.endpoint'] (dev env)
 *   - A running OpenSearch accessible at config['opensearch.endpoint']
 *   - Buckets already created:
 *       config['slaops.oaspec.staging.bucket']
 *       config['slaops.oaspec.storage.bucket']
 *   - Run the OpenSearch migration before first run:
 *       pnpm --filter @slaops/cloud run opensearch:migrate:dev
 */

import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Client } from '@opensearch-project/opensearch'
import { config, loadConfig, resetConfigForTests, setConfigForProcess } from '@slaops/config'
import devEnv from '@slaops/config/dev-env'
import { readFileSync } from 'node:fs'
import { resolveSpec } from '../../../../test-resources/loader'
import { OpenApiIndexerModule } from './openapi-indexer.module'
import { buildS3Client, OpenApiIndexerService } from './openapi-indexer.service'
import { calculateId } from './openapi-parser.service'
// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER = 'ably.net'
const SERVICE = 'control'
const S3_KEY = 'APIs/ably.net/control/v1/openapi.yaml'

const EXPECTED_DOCUMENT_ID = calculateId(PROVIDER, SERVICE, 'v1')

const positiveNumber = { asymmetricMatch: (n: unknown) => typeof n === 'number' && n > 0 }
const nonEmptyArray = { asymmetricMatch: (a: unknown) => Array.isArray(a) && a.length > 0 }
const nonEmptyString = { asymmetricMatch: (s: unknown) => typeof s === 'string' && s.length > 0 }

// ─── Bucket helpers ───────────────────────────────────────────────────────────

async function ensureBucketExists(
  s3: ReturnType<typeof buildS3Client>,
  bucket: string,
): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

const E2E_TIMEOUT = 30_000

describe('OpenAPI Indexer – staging upload E2E', () => {
  let indexerService: OpenApiIndexerService
  let opensearchClient: Client

  beforeAll(async () => {
    setConfigForProcess(loadConfig(devEnv))

    expect(config).toBeDefined()

    expect(config['aws.s3.endpoint']).toBeDefined()

    // Use the same S3Client factory as the service (includes explicit credentials for MinIO)
    const s3Client = buildS3Client()

    // Ensure both buckets exist (idempotent – safe to run against MinIO or real S3)
    await ensureBucketExists(s3Client, config['slaops.oaspec.staging.bucket'])
    await ensureBucketExists(s3Client, config['slaops.oaspec.storage.bucket'])
  }, E2E_TIMEOUT)

  afterAll(() => {
    resetConfigForTests()
  })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), OpenApiIndexerModule],
    }).compile()

    await moduleRef.init()

    indexerService = moduleRef.get(OpenApiIndexerService)
    opensearchClient = moduleRef.get(Client)

    // Clean up any existing document so the test is idempotent
    await indexerService.deleteDocument(EXPECTED_DOCUMENT_ID)
  }, E2E_TIMEOUT)

  it(
    'uploads spec to staging via pre-signed URL, indexes into OpenSearch, saves to storage',
    async () => {
      // ── Step 1: load the spec ────────────────────────────────────────────────
      const specPath = resolveSpec(PROVIDER, SERVICE)
      const specContent = readFileSync(specPath, 'utf-8')
      expect(specContent.length).toBeGreaterThan(0)

      // ── Step 2: generate pre-signed upload URL ───────────────────────────────
      const presignedResult = await indexerService.generatePresignedUploadUrl(S3_KEY)

      expect(presignedResult).toMatchObject({
        url: nonEmptyString,
        // key: S3_KEY,
        bucket: config['slaops.oaspec.staging.bucket'],
        expiresIn: positiveNumber,
      })

      // ── Step 3: upload to staging via the pre-signed URL ────────────────────
      const uploadResponse = await fetch(presignedResult.url, {
        method: 'PUT',
        body: specContent,
        headers: { 'Content-Type': 'text/yaml' },
      })
      expect(uploadResponse.ok).toBe(true)

      // ── Step 4: process from staging (validate → save to storage → index) ───
      const indexResult = await indexerService.processFromStaging(
        config['slaops.oaspec.staging.bucket'],
        presignedResult.key,
      )

      if (!indexResult.success)
        console.error('processFromStaging error:', (indexResult as any).error)
      expect(indexResult).toMatchObject({
        success: true,
        documentId: EXPECTED_DOCUMENT_ID,
        // s3Key: S3_KEY,
        operationCount: positiveNumber,
        pathCount: positiveNumber,
        duration: positiveNumber,
      })

      // ── Step 5: verify document in OpenSearch ────────────────────────────────
      const { body } = await opensearchClient.get({
        index: config['opensearch.index.openapi.apis'],
        id: EXPECTED_DOCUMENT_ID,
      })

      expect(body._source).toMatchObject({
        id: EXPECTED_DOCUMENT_ID,
        provider: PROVIDER,
        serviceName: SERVICE,
        version: 'v1',
        title: nonEmptyString,
        operationStats: expect.objectContaining({
          total: positiveNumber,
          methods: nonEmptyArray,
        }),
        paths: nonEmptyArray,
        s3Location: {
          bucket: config['slaops.oaspec.staging.bucket'],
          key: S3_KEY,
        },
      })

      // ── Step 6: verify spec stored in the storage bucket ────────────────────
      const storedContent = await indexerService.fetchS3Object(
        config['slaops.oaspec.storage.bucket'],
        S3_KEY,
      )

      expect(storedContent).toBe(specContent)
    },
    E2E_TIMEOUT,
  )
})
