import { OpenAPIV3_1 } from "openapi-types"
import SwaggerParser from "@apidevtools/swagger-parser"
import { readFileSync } from "fs"
import { extname } from "path"
import { load as yamlLoad } from "js-yaml"

export function toCamelCase(input: string): string {
    return input
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((segment, index) => {
            const lower = segment.toLowerCase()
            if (index === 0) return lower
            return lower.charAt(0).toUpperCase() + lower.slice(1)
        })
        .join("")
}


const httpMethods: OpenAPIV3_1.HttpMethods[] = [
    "get" as OpenAPIV3_1.HttpMethods,
    "post" as OpenAPIV3_1.HttpMethods,
    "put" as OpenAPIV3_1.HttpMethods,
    "delete" as OpenAPIV3_1.HttpMethods,
    "patch" as OpenAPIV3_1.HttpMethods,
    "head" as OpenAPIV3_1.HttpMethods,
    "options" as OpenAPIV3_1.HttpMethods,
    "trace" as OpenAPIV3_1.HttpMethods,
];


/**
 * Returns only the HTTP method operations from a PathItemObject,
 * excluding non-operation properties like `parameters`, `servers`, or `$ref`.
 */
export function getHttpMethodOperations(
    pathItem: OpenAPIV3_1.PathItemObject
): Array<[OpenAPIV3_1.HttpMethods, OpenAPIV3_1.OperationObject]> {

    const operations: Array<[OpenAPIV3_1.HttpMethods, OpenAPIV3_1.OperationObject]> = []
    for (const method of httpMethods) {
        const maybeOperation = pathItem[method]
        if (maybeOperation && !("$ref" in maybeOperation)) {
            operations.push([method, maybeOperation])
        }
    }
    return operations
}

/**
 * Ensures all operations in the spec have an operationId.
 * Generates one based on method and path if missing.
 */
export function ensureOperationIds(spec: OpenAPIV3_1.Document): OpenAPIV3_1.Document {
    if (!spec.paths) {
        return spec;
    }

    for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!pathItem || "$ref" in pathItem) continue;

        for (const method of httpMethods) {
            const operation = pathItem[method];
            if (!operation || "$ref" in operation) continue;

            // Generate operationId if missing
            if (!operation.operationId) {
                // Convert path like "/users/{id}/posts" to "users_id_posts"
                const pathSegment = path
                    .replace(/^\//, '') // remove leading slash
                    .replace(/[{}]/g, '') // remove braces
                    .replace(/\//g, '_') // replace slashes with underscores
                    .replace(/[^a-zA-Z0-9_]/g, '_'); // replace non-alphanumeric with underscores

                operation.operationId = toCamelCase(`${method}_${pathSegment}`);
            }
        }
    }

    return spec;
}

export class OpenAPIParser {

    constructor(private readonly path: string) {

    }

    async loadSpec(): Promise<OpenAPIV3_1.Document> {
        return loadSpec(this.path);
    }

    loadSpecSync(): OpenAPIV3_1.Document {
        return loadSpecSync(this.path);
    }
}


export async function loadSpec(path: string): Promise<OpenAPIV3_1.Document> {
    const api = await SwaggerParser.bundle(path);
    const spec = api as OpenAPIV3_1.Document;
    return ensureOperationIds(spec);
}

/**
 * Synchronous version of loadSpec.
 * Note: This version does not resolve external $ref references like the async version.
 * It only reads and parses the file synchronously.
 */
export function loadSpecSync(path: string): OpenAPIV3_1.Document {
    const content = readFileSync(path, "utf-8");
    const ext = extname(path).toLowerCase();

    let spec: OpenAPIV3_1.Document;

    if (ext === ".json" || content.trim().startsWith("{")) {
        spec = JSON.parse(content) as OpenAPIV3_1.Document;
    } else if (ext === ".yaml" || ext === ".yml" || content.trim().startsWith("openapi:") || content.trim().startsWith("swagger:")) {
        // Parse YAML using js-yaml
        spec = yamlLoad(content) as OpenAPIV3_1.Document;
    } else {
        // Default to JSON parsing
        spec = JSON.parse(content) as OpenAPIV3_1.Document;
    }

    return ensureOperationIds(spec);
}