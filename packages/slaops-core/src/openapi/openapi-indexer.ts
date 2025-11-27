import { OpenAPIV3_1 } from "openapi-types";
import { hash } from "../util";
import { getHttpMethodOperations } from "./parser";
import { IndexedOperationDoc, IndexedServerDoc } from "./openapi-types";
import { Repository } from "./repo/repo";


export async function buildAPIIndex(specs: OpenAPIV3_1.Document, serverRepo: Repository<IndexedServerDoc>) {

    const apiId = buildApiId(specs)

    const serverDocsAll = buildAllServerDocsToBeIndexed(specs, apiId)

    const serverDocs = serverDocsAll.filter((server, index, self) =>
        index === self.findIndex((t) => t.host_template === server.host_template && t.base_path === server.base_path)
    )

    console.log({ serverDocs })

    const createdServers = await serverRepo.createMany(serverDocs)

    return createdServers


}


/**
 * Used to build all the server docs to be indexed into KeyValueStore. The Partition key will be the 
 * @param spec - The OpenAPI specification
 * @returns An array of server docs to be indexed
 */
export function buildAllServerDocsToBeIndexed(spec: OpenAPIV3_1.Document, apiId: string): IndexedServerDoc[] {
    return (spec.servers ?? [])
        .flatMap(buildServerDoc) // TODO handle the http://s3{dash-or-dot}{region}.amazonaws.com, where by this should produce multiple server patterns, this will change the server_index somehow
        .map((server, index) => ({ ...server, api_id: apiId, server_index: index }))
}


/**
 * 
 * Builds the operation doc to be indexed into KeyValueStore. Operations will be found by their API ID and then their total_components. Then operations will be loaded into memory for quick matching against the request.
 * 
 * Searching reasoning:
 * // TODO Best Guess: check most obvious lookup, replace ints with {integer}, and uuid with {string}, and see if there is a match.
 * // Exact Guess: check the path exactly as it is and see if there is an operation which matches exactly
 * // Smart Guess: index paths by main branches, to reduce the number of trie structures needed to search through.
 * Otherwise pull all operations which match the apiId and the number of components in the path
 * 
 * @param operation - The operation object
 * @param apiId - The API ID
 * @returns The operation doc to be indexed
 * @returns 
 */
export function buildOperationDocToBeIndexed(operation: {
    operation_id: string;
    operation_path: string;
    method: OpenAPIV3_1.HttpMethods
}, apiId: string): IndexedOperationDoc {

    return {

        api_id: apiId,
        operation_id: operation.operation_id,
        operation_path: operation.operation_path,
        method: operation.method,

        total_components: operation.operation_path.split("/").length,
        // fixed_components: operation.operation_path.split("/").filter(component => !component.includes("{")).length,
        // var_components: operation.operation_path.split("/").filter(component => component.includes("{")).length,
    }

}


/**
 * Used to build all the operation docs to be indexed into KeyValueStore. The Partition key will be the API ID.
 * @param spec - The OpenAPI specification
 * @param apiId - The API ID
 * @returns An array of operation docs to be indexed
 */
export function buildAllOperationDocsToBeIndexed(spec: OpenAPIV3_1.Document, apiId: string) {
    return Object.entries(spec.paths!).flatMap(([path, pathObj]) => {
        const operations = [];
        if (!pathObj) return;
        for (const [method, operation] of getHttpMethodOperations(pathObj)) {
            if (operation) {
                operations.push(
                    buildOperationDocToBeIndexed(
                        buildOperationItem({ method, path: path, operation }), apiId
                    )
                );
            }
        }
        return operations
    })
}


/**
 * Used to find the identifiable attributes of the OpenAPI specification
 * @param spec - The OpenAPI specification
 * @returns The identifiable attributes of the OpenAPI specification
 */
export const findOpenApiIdentifiableAttributes = (spec: OpenAPIV3_1.Document) => ({
    version: spec.info.version,
    title: spec.info.title,
    servers: spec.servers?.find(server => server.url)?.url ?? spec.externalDocs?.url ?? ""
})


/**
 * Used to build the API ID from the OpenAPI specification
 * @param spec - The OpenAPI specification
 * @returns The API ID
 */
export const buildApiId = (spec: OpenAPIV3_1.Document) => hash(JSON.stringify(findOpenApiIdentifiableAttributes(spec)))


/**
 * Used to find the template of the hostname for quick retrieval of which openapi specification meets a given request
 * @param hostname - The hostname including variables such as {region}
 * @returns The hostname with variables such as {region} replaced with *
 */
export function hostTemplate(hostname: string) {
    return hostname.replace(/\{[^}]+\}/g, "*");
}


/**
 * 
 * TODO need to handle the http://s3{dash-or-dot}{region}.amazonaws.com, where by this should produce multiple server patterns
 * Will need to have the concept of a server variant
 * 
 * Used to index the server object from the OpenAPI specification for quick retrieval of which openapi specification meets a given request
 * @param server - The server object from the OpenAPI specification
 * @returns The host_template and base path of the server
 */
export const buildServerDoc = (server: OpenAPIV3_1.ServerObject) => {

    const url = new URL(server.url);

    return {
        host_template: hostTemplate(url.hostname),
        base_path: url.pathname,
        server_url: server.url,
    }

}

/**
 * Used to index all the server objects from the OpenAPI specification for quick retrieval of which openapi specification meets a given request
 * @param spec - The OpenAPI specification
 * @returns An array of server documents
 */
export const buildAllServerDocs = (spec: OpenAPIV3_1.Document) => {
    return spec.servers?.flatMap(buildServerDoc) ?? [];
}


/**
 * 
 * @param pathObject - The path object from the OpenAPI specification
 * @returns 
 */
export const buildOperationItem = (pathObject: {
    method: OpenAPIV3_1.HttpMethods,
    path: string,
    operation: OpenAPIV3_1.OperationObject
}
) => {

    const { method, path, operation } = pathObject;

    return {
        operation_id: operation.operationId!,
        operation_path: path,
        method,
    }
}