import { configFromEnv, getConfigInputOverride, setOnCacheReset } from './from-env'
import { ConfigInput } from './schema'

import local from './local-env'
import test from './test-env'

const configs: { [env: string]: ConfigInput } = {
  local,
  test,
}

function getDefaultConfigInput(): ConfigInput {
  return configFromEnv({
    ...(configs[process.env.NODE_ENV ?? process.env.STAGE ?? 'local'] ?? {}),
    ...process.env,
  })
}

function getMatchingEntries<T extends Record<string, any>>(obj: T, prefix: string): Partial<T> {
  const result: Partial<T> = {}

  for (const key in obj) {
    if (key.startsWith(prefix)) {
      result[key] = obj[key]
    }
  }

  return result
}

export function configAtPrefix(prefix: string) {
  return getMatchingEntries(config, prefix)
}

export function mapKeysToLastSegment<T extends Record<string, any>>(input: T): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(input)) {
    const segments = key.split('.')
    const newKey = segments[segments.length - 1]
    result[newKey!] = value
  }

  return result
}

export const makeConfig = (cfg?: ConfigInput) => {
  const input = cfg ?? getConfigInputOverride() ?? getDefaultConfigInput()

  const isProd = ['prod', 'staging'].includes(input.NODE_ENV)

  const appName = (input.APP_NAME ?? 'SLAOps') + ''
  const app = appName.toLowerCase()
  const env = (input.NODE_ENV ?? 'dev').toLowerCase()
  const globalTenantId = 't-glbl0000'

  const opensearchPrefix = input.OPENSEARCH_INDEX_PREFIX ?? `${env}--${app}`.toLowerCase()

  const opensearchIndexName = (domain: string, entity: string) =>
    `${opensearchPrefix}--${domain}--${entity}`.toLowerCase()
  const opensearchTenantIndexName = (tenantId: string, domain: string, entity: string) =>
    `${opensearchPrefix}--${entity}--${domain}--${tenantId}`.toLowerCase()

  const logBucketName = (tenantId: string) =>
    `${input.AWS_REGION}--${env}--${app}--${tenantId}--logs--storage`

  return {
    /** Whether to enable mock authentication, note that this is very dangerous and should not be enabled in production */
    'app.auth.mock.enabled': !isProd && input.VITE_APP_AUTH_MOCK_ENABLED,

    'app.auth.mock.payload.sub': '12345678-1234-1234-1234-123456789012',
    'app.auth.mock.payload.cognito:username': 'derrops',
    'app.auth.mock.payload.email': 'derrops@derrops.com',
    'app.auth.mock.payload.email_verified': true,
    'app.auth.mock.payload.iss':
      'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_XUMcOaNb2',
    'app.auth.mock.payload.aud': '1example23456789',
    'app.auth.mock.payload.token_use': 'access',
    'app.auth.mock.payload.scope': 'aws.cognito.signin.user.admin',
    'app.auth.mock.payload.auth_time': 1643723400,
    'app.auth.mock.payload.iat': 1643723400,
    'app.auth.mock.payload.exp': 1643727000,
    'app.auth.mock.payload.client_id': '1example23456789',
    'app.auth.mock.payload.custom:tenant_id': 't-test0000',
    'app.auth.mock.payload.custom:customer_id': 'c-bank0000',

    /** Single shared bucket for all tenant OASpec raw files. Object keys are prefixed with {tenantId}/.
     *  Per-tenant dedicated buckets are a future infrastructure task. */
    'slaops.oaspec.storage.bucket': `${input.AWS_REGION}--${env}--${app}--${globalTenantId}--oaspec--storage`,

    /** Global tenant ID for the SLAOps-managed public catalogue */
    'opensearch.oaspec.global-tenant-id': 't-glbl0000',

    /** Number of spec versions to retain in OpenSearch per API (older versions are pruned after indexing) */
    'opensearch.oaspec.version-retention': 2,

    /** Maximum number of operation documents indexed per spec run (excess truncated) */
    'opensearch.oaspec.max-operations-per-spec': 2000,

    /** Maximum number of parameter documents indexed per spec run (excess truncated) */
    'opensearch.oaspec.max-params-per-spec': 5000,

    /** Maximum number of model documents indexed per spec run (excess truncated) */
    'opensearch.oaspec.max-models-per-spec': 1000,

    /** Relevance boost applied to tenant private index documents in global search results */
    'opensearch.oaspec.tenant-boost': 2.0,

    /** Default cron schedule for the url_fetch version strategy (UTC) */
    'oaspec.url-fetch.default-cron': '0 2 * * *',

    /** HTTP fetch timeout in milliseconds for the url_fetch version strategy */
    'oaspec.url-fetch.timeout-ms': 30_000,

    /** HTTP fetch timeout in milliseconds for the GET /apis/info proxy endpoint */
    'api.info.fetch.timeout-ms': 10_000,

    /** Consecutive fetch failures before reducing retry cadence to weekly */
    'oaspec.url-fetch.backoff-threshold': 3,

    /** TTL in seconds for DynamoDB host→specId enrichment cache entries */
    'dynamodb.oaspec-cache.ttl-seconds': 300,

    /** Global Tenant ID */
    'tenant.global.id': globalTenantId,

    /** Global Tenant Name */
    'tenant.global.name': 'SLAOps Global Tenant',

    /** Allowed characters for the tenant ID */
    'tenant.id.chars': 'abcdefghjkmnpqrstuvwxyz23456789',
    /** Number of characters for the tenant ID */
    'tenant.id.no': 8,
    /** Prefix for the tenant ID */
    'tenant.id.prefix': 't-',

    /** The version of NodeJS the application uses*/
    'node.version': input.NODE_VERSION ?? 22,

    /** The environment the application is running in */
    'node.env': input.NODE_ENV ?? 'dev',

    /** The region the application is running in */
    'aws.region': input.AWS_REGION,
    /** The account ID the application is running in */
    'aws.accountId': input.AWS_ACCOUNT_ID,

    /** The runtime of the application */
    'aws.lambda.runtime': input.AWS_LAMBDA_RUNTIME ?? 'nodejs22.x',
    /** The memory of the application */
    'aws.lambda.memory': input.AWS_LAMBDA_MEMORY ?? 2048,
    /** The timeout of the application */
    'aws.lambda.timeout.seconds': 20,

    'aws.cognito.userPoolId': input.AWS_COGNITO_USER_POOL_ID,
    // 'aws.cognito.userPoolClientId': cfg.AWS_COGNITO_USER_POOL_CLIENT_ID,
    // 'aws.cognito.identityPoolId': cfg.AWS_COGNITO_IDENTITY_POOL_ID,

    /**
    "user_pool_id": "ap-southeast-2_XUMcOaNb2",
    "aws_region": "ap-southeast-2",
    "user_pool_client_id": "5ecm72u58jjgvebt0dcbelgctq",
    "identity_pool_id": "ap-southeast-2:1881e13f-256b-4b2a-a8f5-7c2fd6bb85d1",
     */

    // Application properties, properties regarding the actual application
    'app.port': input.PORT,
    'app.env': input.NODE_ENV,
    'app.name': input.APP_NAME,
    'app.version': input.APP_VERSION ?? '0.0.1',
    'app.debug': input.APP_DEBUG ?? false,

    /** When true, error responses include the full stack trace and original error message instead of the generic "Internal server error" message. Enabled automatically when APP_DEBUG is set in non-production environments. */
    'app.error.verbose': !isProd && Boolean(input.APP_DEBUG),

    // Open API properties
    'openapi.version': input.APP_VERSION,
    'openapi.title': `${input.APP_NAME} Cloud API`,
    'openapi.description': `${input.APP_NAME} is a platform for managing and monitoring SLA metrics of SAAS applications`,
    'openapi.author': 'Derrops',
    'openapi.license': 'MIT',
    'openapi.url': `https://${app}.com`,
    'openapi.email': 'derrickfutschik@hotmail.com',
    'openapi.phone': '+1234567890',
    'openapi.address': '123 Main St, Anytown, USA',

    // Database properties
    'db.username': input.DB_USERNAME,
    'db.password': input.DB_PASSWORD,
    'db.host': input.DB_HOST,
    'db.port': input.DB_PORT ?? 5432,
    'db.database': input.DB_DATABASE ?? `${appName}-${env}`,
    'db.ssl': input.DB_SSL ?? 'false',
    'db.logging': input.DB_LOGGING ?? 'false',
    'db.schema': input.DB_SCHEMA ?? 'public',

    /** The endpoint to access dynamodb */
    'dynamodb.endpoint': input.DYNAMODB_ENDPOINT,

    /** The region opensearch is deployed in  */
    'opensearch.region': input.AWS_REGION,

    /** The endpoint to access opensearch */
    'opensearch.endpoint': input.OPENSEARCH_ENDPOINT,

    /** The index prefix */
    'opensearch.prefix': opensearchPrefix,

    /** The suffix for the index */
    'opensearch.suffix': opensearchSuffix,

    /** Index of the OpenAPI APIs */
    'opensearch.index.openapi.apis': opensearchIndexName('openapi-apis'),

    /** Index of the OpenAPI Operations */
    'opensearch.index.openapi.operations': opensearchIndexName('openapi-operations'),

    /** Template of the OpenAPI APIs */
    'opensearch.template.openapi.apis': opensearchIndexName('openapi-apis'),

    /** Template of the OpenAPI Operations */
    'opensearch.template.openapi.operations': opensearchIndexName('openapi-operations'),

    /** Pipeline of the OpenAPI APIs */
    'opensearch.pipeline.openapi.apis': opensearchIndexName('openapi-apis'),

    /** Pipeline of the OpenAPI Operations */
    'opensearch.pipeline.openapi.operations': opensearchIndexName('openapi-operations'),

    /** Returns the OASpec index name for a given tenant and entity type.
     *  Pattern: {prefix}--{env}--{tenantId}--oaspec--{entity}
     *  Example: slaops--dev--t-abc123--oaspec--spec */
    'opensearch.oaspec.index': (tenantId: string, entity: string) =>
      `${opensearchPrefix}--${tenantId}--oaspec--${entity}`,

    /** Returns the OASpec search alias name for a given tenant and entity type.
     *  Pattern: {prefix}--{env}--{tenantId}--oaspec--{entity}--search
     *  Example: slaops--dev--t-abc123--oaspec--spec--search */
    'opensearch.oaspec.search-alias': (tenantId: string, entity: string) =>
      `${opensearchPrefix}--${tenantId}--oaspec--${entity}--search`,

    'app.pagination.default.size': 20,

    /** Defaults for pagination */
    'app.pagination.default.from': 0,

    'openapi.s3.bucket': `${app}-apis-${env}`,

    'aws.s3.endpoint': input.AWS_S3_ENDPOINT,
    'aws.s3.region': input.AWS_REGION,

    'app.opneapi-indexer.name': 'openapi-indexer',
    'app.api.name': `${appName}-api`,

    /** How long (in seconds) an undelivered relay job message is retained in the SQS FIFO queue before being discarded. Default: 4 days. */
    'relay.queue.message-retention-seconds': 4 * 24 * 60 * 60,

    /** Visibility timeout (in seconds) for relay job messages. If the relay crashes mid-job the message reappears after this period. */
    'relay.queue.visibility-timeout-seconds': 120,

    /** Maximum JSON request body size accepted by the HTTP server (Express body-parser limit string). Relay job results can carry full HTTP response bodies, so this must be large enough to accommodate them. */
    'app.body.json.limit': '10mb',
  }
}

export type AppConfig = ReturnType<typeof makeConfig>

let appConfigCache: AppConfig | null = null
let appConfigCacheKey: ConfigInput | undefined = undefined

function getConfig(): AppConfig {
  const input = getConfigInputOverride() ?? getDefaultConfigInput()
  if (input !== appConfigCacheKey) {
    appConfigCacheKey = input
    appConfigCache = makeConfig(input)
  }
  return appConfigCache!
}

/** Resets app config cache (called when resetConfigForTests runs). */
function invalidateConfigCache() {
  appConfigCache = null
  appConfigCacheKey = undefined
}

setOnCacheReset(invalidateConfigCache)

export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_, prop: string) {
    return getConfig()[prop as keyof AppConfig]
  },
  ownKeys(_) {
    return Object.keys(getConfig())
  },
  getOwnPropertyDescriptor(_, prop: string) {
    const cfg = getConfig()
    if (prop in cfg) {
      return { enumerable: true, configurable: true, value: cfg[prop as keyof AppConfig] }
    }
    return undefined
  },
})
