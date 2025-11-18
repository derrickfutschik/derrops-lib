import { OpenAPIV3_1 } from "openapi-types";


export function hostShape(hostname: string) {
    return hostname.replace(/\{[^}]+\}/g, "*");
}


export const indexServer = (server: OpenAPIV3_1.ServerObject) => {

    const url = new URL(server.url);

    return {
        host_shape: hostShape(url.hostname),
        base_path: url.pathname,
    }
}