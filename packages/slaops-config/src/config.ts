import { configFromEnv } from "./from-env";
import { AppConfigEnv, ConfigInput } from "./schema";

const env = process.env.STAGE ?? process.env.NODE_ENV ?? "dev"

import local from "./local-env";
import test from "./test-env";

const configs: { [env: string]: ConfigInput } = {
    local,
    test,
}


export const makeConfig = (cfg: ConfigInput = configFromEnv({
    ...(configs[process.env.NODE_ENV ?? process.env.STAGE ?? "local"] ?? {}),
    ...process.env
})) => {
    // const cfg = configFromEnv(env);

    const appName = cfg.APP_NAME ?? "SLAOps";
    const app = appName.toLowerCase();
    const env = (cfg.NODE_ENV ?? "dev").toLowerCase();

    return {

        "aws.region": cfg.AWS_REGION,
        "aws.accountId": cfg.AWS_ACCOUNT_ID,

        // Application properties, properties regarding the actual application
        "app.port": cfg.PORT,
        "app.env": cfg.NODE_ENV,
        "app.name": cfg.APP_NAME,
        "app.version": cfg.APP_VERSION ?? "0.0.1",

        // Open API properties
        "openapi.version": cfg.APP_VERSION,
        "openapi.title": `${cfg.APP_NAME} Cloud API`,
        "openapi.description": `${cfg.APP_NAME} is a platform for managing and monitoring SLA metrics of SAAS applications`,
        "openapi.author": "Derrops",
        "openapi.license": "MIT",
        "openapi.url": `https://${app}.com`,
        "openapi.email": "derrickfutschik@hotmail.com",
        "openapi.phone": "+1234567890",
        "openapi.address": "123 Main St, Anytown, USA",

        // Database properties
        "db.username": cfg.DB_USERNAME,
        "db.password": cfg.DB_PASSWORD,
        "db.host": cfg.DB_HOST,
        "db.port": cfg.DB_PORT ?? "5432",
        "db.database": cfg.DB_DATABASE ?? `${appName}-${env}`,
        "db.ssl": cfg.DB_SSL ?? "false",
        "db.logging": cfg.DB_LOGGING ?? "false",
        "db.schema": cfg.DB_SCHEMA ?? "public",

        //opensearch properties

        /** The region opensearch is deployed in  */
        "opensearch.region": cfg.AWS_REGION,

        /** The endpoint to access opensearch */
        "opensearch.endpoint": cfg.OPENSEARCH_ENDPOINT,

        /** The index prefix */
        "opensearch.index.prefix": cfg.OPENSEARCH_INDEX_PREFIX ?? `${app}-`.toLowerCase(),

        /** The suffix for the index */
        "opensearch.index.suffix": cfg.OPENSEARCH_INDEX_SUFFIX ?? `-${env}`.toLowerCase(),

        /** Find the name of an index */
        "opensearch.index": (entity: string) => `${app}-${entity}-${env}`.toLowerCase(),

        "openapi.s3.bucket": `${app}-openapis-${env}`,


        "aws.s3.endpoint": cfg.AWS_S3_ENDPOINT,

    }
}

export type AppConfig = ReturnType<typeof makeConfig>;


export const config = makeConfig();