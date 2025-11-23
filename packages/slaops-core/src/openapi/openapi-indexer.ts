import { OpenAPIV3_1 } from "openapi-types";


/**
 * Used to shape the hostname for quick retrieval of which openapi specification meets a given request
 * @param hostname - The hostname including variables such as {region}
 * @returns The hostname with variables such as {region} replaced with *
 */
export function hostShape(hostname: string) {
    return hostname.replace(/\{[^}]+\}/g, "*");
}


/**
 * Used to index the server object from the OpenAPI specification for quick retrieval of which openapi specification meets a given request
 * @param server - The server object from the OpenAPI specification
 * @returns The host shape and base path of the server
 */
export const buildServerDoc = (server: OpenAPIV3_1.ServerObject) => {

    const url = new URL(server.url);

    return {
        host_shape: hostShape(url.hostname),
        base_path: url.pathname,
    }

}

/**
 * Used to index all the server objects from the OpenAPI specification for quick retrieval of which openapi specification meets a given request
 * @param spec - The OpenAPI specification
 * @returns An array of server documents
 */
export const buildAllServerDocs = (spec: OpenAPIV3_1.Document) => {
    return spec.servers?.map(buildServerDoc) ?? [];
}


/**
 * 
 * @param pathObject - The path object from the OpenAPI specification
 * @returns 
 */
export const buildOperationItem = (

    pathObject: {
        method: OpenAPIV3_1.HttpMethods,
        path: string,
        operation: OpenAPIV3_1.OperationObject
    }

) => {

    const { method, path, operation } = pathObject;

    return {
        operation_id: operation.operationId,
        controller_path: path,
        method,
    }
}