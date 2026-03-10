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

export const makeConfig = (cfg?: ConfigInput) => {
  const input = cfg ?? getConfigInputOverride() ?? getDefaultConfigInput()

  const appName = (input.APP_NAME ?? 'SLAOps') + ''
  const app = appName.toLowerCase()
  const env = (input.NODE_ENV ?? 'dev').toLowerCase()
  const globalTenantId = 't-glbl0000'

  const opensearchPrefix = input.OPENSEARCH_INDEX_PREFIX ?? `${app}`.toLowerCase()
  const opensearchSuffix = input.OPENSEARCH_INDEX_SUFFIX ?? `${env}`.toLowerCase()

  const opensearchName = (entity: string) =>
    `${opensearchPrefix}-${entity}-${opensearchSuffix}`.toLowerCase()

  const logBucketName = (tenantId: string) =>
    `${input.AWS_REGION}--${env}--${app}--${tenantId}--logs--storage`

  return {
    /** The bucket for the OASpecs Storage */
    'slaops.oaspec.storage.bucket': `${input.AWS_REGION}--${env}--${app}--${globalTenantId}--oaspec--storage`,

    /** The bucket for the OASpec Staging Bucket */
    'slaops.oaspec.staging.bucket': `${input.AWS_REGION}--${env}--${app}--${globalTenantId}--oaspec--staging`,

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
    'opensearch.index.openapi.apis': opensearchName('openapi-apis'),

    /** Index of the OpenAPI Operations */
    'opensearch.index.openapi.operations': opensearchName('openapi-operations'),

    /** Template of the OpenAPI APIs */
    'opensearch.template.openapi.apis': opensearchName('openapi-apis'),

    /** Template of the OpenAPI Operations */
    'opensearch.template.openapi.operations': opensearchName('openapi-operations'),

    /** Pipeline of the OpenAPI APIs */
    'opensearch.pipeline.openapi.apis': opensearchName('openapi-apis'),

    /** Pipeline of the OpenAPI Operations */
    'opensearch.pipeline.openapi.operations': opensearchName('openapi-operations'),

    'app.pagination.default.size': 20,

    /** Defaults for pagination */
    'app.pagination.default.from': 0,

    'openapi.s3.bucket': `${app}-apis-${env}`,

    'aws.s3.endpoint': input.AWS_S3_ENDPOINT,
    'aws.s3.region': input.AWS_REGION,

    'app.opneapi-indexer.name': 'openapi-indexer',
    'app.api.name': `${appName}-api`,
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
})
