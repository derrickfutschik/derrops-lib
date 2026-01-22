import { configFromEnv } from "./from-env";
import { AppConfigEnv } from "./schema";

export const makeConfig = (cfg: AppConfigEnv = configFromEnv(process.env)) => {
    // const cfg = configFromEnv(env);


    return {

        // Application properties, properties regarding the actual application
        "app.port": cfg.PORT,
        "app.env": cfg.NODE_ENV,
        "app.name": cfg.APP_NAME,
        "app.version": cfg.APP_VERSION,

        // Open API properties
        "openapi.version": cfg.APP_VERSION,
        "openapi.title": "SLAOps Cloud API",
        "openapi.description": "SLAOps is a platform for managing and monitoring SLA metrics of SAAS applications",
        "openapi.author": "Derrops",
        "openapi.license": "MIT",
        "openapi.url": "https://slaops.com",
        "openapi.email": "derrickfutschik@hotmail.com",
        "openapi.phone": "+1234567890",
        "openapi.address": "123 Main St, Anytown, USA",

        // Database properties
        "db.username": cfg.DB_USERNAME,
        "db.password": cfg.DB_PASSWORD,
        "db.host": cfg.DB_HOST,
        "db.port": cfg.DB_PORT,
        "db.database": cfg.DB_DATABASE,
        "db.ssl": cfg.DB_SSL,
        "db.logging": cfg.DB_LOGGING,

        //opensearch properties

        /** The region opensearch is deployed in  */
        "opensearch.region": cfg.AWS_REGION,

        /** The endpoint to access opensearch */
        "opensearch.endpoint": cfg.OPENSEARCH_ENDPOINT,

        /** The index prefix */
        "opensearch.index.prefix": `${cfg.APP_NAME}-`.toLowerCase(),

        /** The suffix for the index */
        "opensearch.index.suffix": `-${cfg.NODE_ENV}`.toLowerCase(),

        /** Find the name of an index */
        "opensearch.index": (entity: string) => `${cfg.APP_NAME}-${entity}-${cfg.NODE_ENV}`.toLowerCase(),


    }
}

export type AppConfig = ReturnType<typeof makeConfig>;

export const config = makeConfig();