import { OpenAPIV3_1 } from "openapi-types"


export type ZippedOperation = {
    o_i?: string; // operation_id
    v_p: string; // variable_path
    m: string; // method (first character only)
    m_i: number[]; // model_indices
    p_k: string; // partition_key
};

/**
 Abbreviates parameter types for compact representation
 e.g., {integer} => {i}, {string} => {s}
 */
function abbreviateParameterType(type: string): string {
    const typeMap: Record<string, string> = {
        integer: "i",
        string: "s",
        number: "n",
        boolean: "b",
        array: "a",
        object: "o",
    };

    const lowerType = type.toLowerCase();
    return typeMap[lowerType] || lowerType.charAt(0);
}

/**
 * Gets the first character of HTTP method for compact representation
 */
function getMethodShorthand(method: string): string {
    return method.toUpperCase().charAt(0);
}

/**
 * Replaces path parameters with their type abbreviations
 * e.g., /users/{userId}/logout where userId is integer => /users/{i}/logout
 */
function buildVariablePath(
    path: string,
    pathItem: OpenAPIV3_1.PathItemObject,
    operation: OpenAPIV3_1.OperationObject
): string {
    let variablePath = path;

    // Combine path-level and operation-level parameters
    const allParams = [
        ...(pathItem.parameters || []),
        ...(operation.parameters || []),
    ];

    // Filter to path parameters only
    const pathParams = allParams.filter((param) => {
        if ("$ref" in param) {
            // Skip $ref parameters for now - would need to resolve
            return false;
        }
        return param.in === "path";
    });

    // Replace path parameters with their type abbreviations
    for (const param of pathParams) {
        if ("$ref" in param) continue;

        const paramName = param.name;
        let paramType = "string"; // default

        if (param.schema) {
            // Check if it's a ReferenceObject ($ref) or SchemaObject
            if ("$ref" in param.schema) {
                // Can't resolve $ref here, default to string
                paramType = "string";
            } else if ("type" in param.schema && param.schema.type) {
                // It's a SchemaObject with a type
                paramType = typeof param.schema.type === "string"
                    ? param.schema.type
                    : "string";
            }
        }

        const abbreviatedType = abbreviateParameterType(paramType);

        // Replace {paramName} with {abbreviatedType}
        variablePath = variablePath.replace(
            `{${paramName}}`,
            `{${abbreviatedType}}`
        );
    }

    return variablePath;
}

/**
 * Extracts schema references from an operation and maps them to indices
 * in the components.schemas array
 */
function extractModelIndices(
    operation: OpenAPIV3_1.OperationObject,
    spec: OpenAPIV3_1.Document
): number[] {
    const modelIndices: number[] = [];
    const schemas = spec.components?.schemas || {};
    const schemaKeys = Object.keys(schemas);

    // Helper to resolve $ref to schema name
    const resolveSchemaName = (ref: string): string | null => {
        if (ref.startsWith("#/components/schemas/")) {
            return ref.replace("#/components/schemas/", "");
        }
        return null;
    };

    // Extract from requestBody
    if (operation.requestBody) {
        if ("$ref" in operation.requestBody) {
            const schemaName = resolveSchemaName(operation.requestBody.$ref);
            if (schemaName) {
                const index = schemaKeys.indexOf(schemaName);
                if (index !== -1 && !modelIndices.includes(index)) {
                    modelIndices.push(index);
                }
            }
        } else if (operation.requestBody.content) {
            for (const content of Object.values(operation.requestBody.content)) {
                if (content.schema) {
                    if ("$ref" in content.schema) {
                        const schemaName = resolveSchemaName(content.schema.$ref);
                        if (schemaName) {
                            const index = schemaKeys.indexOf(schemaName);
                            if (index !== -1 && !modelIndices.includes(index)) {
                                modelIndices.push(index);
                            }
                        }
                    }
                }
            }
        }
    }

    // Extract from responses
    if (operation.responses) {
        for (const response of Object.values(operation.responses)) {
            if ("$ref" in response) {
                // Skip $ref responses - would need to resolve
                continue;
            }

            if (response.content) {
                for (const content of Object.values(response.content)) {
                    if (content.schema) {
                        if ("$ref" in content.schema) {
                            const schemaName = resolveSchemaName(content.schema.$ref);
                            if (schemaName) {
                                const index = schemaKeys.indexOf(schemaName);
                                if (index !== -1 && !modelIndices.includes(index)) {
                                    modelIndices.push(index);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return modelIndices.sort((a, b) => a - b);
}

/**
 * Builds the partition key in format: M:{type}/path
 * e.g., P:{i}/logout
 */
function buildPartitionKey(
    method: string,
    variablePath: string
): string {
    const methodShorthand = getMethodShorthand(method);
    // Remove leading slash from path if present
    const cleanPath = variablePath.startsWith("/")
        ? variablePath.slice(1)
        : variablePath;
    return `${methodShorthand}:${cleanPath}`;
}

/**
 * Zips operations from an OpenAPI specification into a compact format
 * for efficient storage and matching in DynamoDB.
 * 
 * Based on the Operation Matching specification:
 * - Compresses operations to minimize size
 * - Creates partition keys for efficient lookup
 * - Maps model references to indices for single-hop lookups
 */
export function zipOperations(
    spec: OpenAPIV3_1.Document
): ZippedOperation[] {
    const zipped: ZippedOperation[] = [];

    if (!spec.paths) {
        return zipped;
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

    // Iterate through all paths
    for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!pathItem) continue;

        // Skip $ref paths
        if ("$ref" in pathItem) continue;

        // Iterate through all HTTP methods
        for (const method of httpMethods) {
            const operation = pathItem[method];
            if (!operation) continue;

            // Skip $ref operations
            if ("$ref" in operation) continue;

            // Skip operations without operationId (optional but useful)
            if (!operation.operationId) continue;

            // Build variable path
            const variablePath = buildVariablePath(path, pathItem, operation);

            // Extract model indices
            const modelIndices = extractModelIndices(operation, spec);

            // Build partition key
            const partitionKey = buildPartitionKey(method, variablePath);

            // Create zipped operation
            zipped.push({
                o_i: operation.operationId,
                v_p: variablePath,
                m: getMethodShorthand(method),
                m_i: modelIndices,
                p_k: partitionKey,
            });
        }
    }

    return zipped;
}