import { configFromEnv } from "./from-env";

export const makeConfig = (env: NodeJS.ProcessEnv = process.env) => {
    const cfg = configFromEnv(env);
    return {
        "app.port": cfg.PORT,
        "app.env": cfg.NODE_ENV,
        "app.name": "SLAOps",
        "app.version": cfg.APP_VERSION,
        "app.title": "SLAOps Cloud API",
        "app.description": "SLAOps is a platform for managing and monitoring SLA metrics",
        "app.author": "Derrops",
        "app.license": "MIT",
        "app.url": "https://slaops.com",
        "app.email": "derrickfutschik@hotmail.com",
        "app.phone": "+1234567890",
        "app.address": "123 Main St, Anytown, USA",
    }
}

export type AppConfig = ReturnType<typeof makeConfig>;