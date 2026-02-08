import { configFromEnv } from './from-env'
import { ConfigInput } from './schema'

const env = process.env.STAGE ?? process.env.NODE_ENV ?? 'dev'

import local from './local-env'
import test from './test-env'

const configs: { [env: string]: ConfigInput } = {
  local,
  test,
}

export const makeConfig = (
  cfg: ConfigInput = configFromEnv({
    ...(configs[process.env.NODE_ENV ?? process.env.STAGE ?? 'local'] ?? {}),
    ...process.env,
  }),
) => {
  // const cfg = configFromEnv(env);

  const appName = (cfg.APP_NAME ?? 'SLAOps') + ''
  const app = appName.toLowerCase()
  const env = (cfg.NODE_ENV ?? 'dev').toLowerCase()

  const opensearchPrefix = cfg.OPENSEARCH_INDEX_PREFIX ?? `${app}`.toLowerCase()
  const opensearchSuffix = cfg.OPENSEARCH_INDEX_SUFFIX ?? `${env}`.toLowerCase()

  const opensearchName = (entity: string) =>
    `${opensearchPrefix}-${entity}-${opensearchSuffix}`.toLowerCase()

  return {
    /** The version of NodeJS the application uses*/
    'node.version': cfg.NODE_VERSION ?? 22,
    'node.env': cfg.NODE_ENV ?? 'dev',

    'aws.region': cfg.AWS_REGION,
    'aws.accountId': cfg.AWS_ACCOUNT_ID,

    'aws.lambda.runtime': cfg.AWS_LAMBDA_RUNTIME ?? 'nodejs22.x',
    'aws.lambda.memory': cfg.AWS_LAMBDA_MEMORY ?? 2048,
    'aws.lambda.timeout.seconds': 20,

    // Application properties, properties regarding the actual application
    'app.port': cfg.PORT,
    'app.env': cfg.NODE_ENV,
    'app.name': cfg.APP_NAME,
    'app.version': cfg.APP_VERSION ?? '0.0.1',
    'app.debug': cfg.APP_DEBUG ?? false,

    // Open API properties
    'openapi.version': cfg.APP_VERSION,
    'openapi.title': `${cfg.APP_NAME} Cloud API`,
    'openapi.description': `${cfg.APP_NAME} is a platform for managing and monitoring SLA metrics of SAAS applications`,
    'openapi.author': 'Derrops',
    'openapi.license': 'MIT',
    'openapi.url': `https://${app}.com`,
    'openapi.email': 'derrickfutschik@hotmail.com',
    'openapi.phone': '+1234567890',
    'openapi.address': '123 Main St, Anytown, USA',

    // Database properties
    'db.username': cfg.DB_USERNAME,
    'db.password': cfg.DB_PASSWORD,
    'db.host': cfg.DB_HOST,
    'db.port': cfg.DB_PORT ?? 5432,
    'db.database': cfg.DB_DATABASE ?? `${appName}-${env}`,
    'db.ssl': cfg.DB_SSL ?? 'false',
    'db.logging': cfg.DB_LOGGING ?? 'false',
    'db.schema': cfg.DB_SCHEMA ?? 'public',

    //opensearch properties

    /** The region opensearch is deployed in  */
    'opensearch.region': cfg.AWS_REGION,

    /** The endpoint to access opensearch */
    'opensearch.endpoint': cfg.OPENSEARCH_ENDPOINT,

    /** The index prefix */
    'opensearch.index.prefix': opensearchPrefix,

    /** The suffix for the index */
    'opensearch.index.suffix': opensearchSuffix,

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

    'openapi.s3.bucket': `${app}-openapis-${env}`,

    'aws.s3.endpoint': cfg.AWS_S3_ENDPOINT,

    'app.opneapi-indexer.name': 'openapi-indexer',
    'app.api.name': `${appName}-api`,
  }
}

export type AppConfig = ReturnType<typeof makeConfig>

export const config = makeConfig()
