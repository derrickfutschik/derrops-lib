import { OpenAPIV3_1 } from "openapi-types";



export const EMPTY_OPERATION_SPEC: OpenAPIV3_1.Document = {
    openapi: "3.1.0",
    info: { title: "Empty API", version: "1.0.0" },
    components: {},
}

export const SINGLE_OPERATION_SPEC_GET_USER: OpenAPIV3_1.Document = {
    openapi: "3.1.0",
    info: { title: "Test API", version: "1.0.0" },
    paths: {
        "/users/{userId}": {
            get: {
                operationId: "getUser",
                parameters: [
                    {
                        name: "userId",
                        in: "path",
                        required: true,
                        schema: { type: "integer" },
                    },
                ],
                responses: {
                    "200": {
                        description: "Success",
                    },
                },
            },
        },
    },
}



export const LIST_USERS_OPERATION_SPEC: OpenAPIV3_1.Document = {
    openapi: "3.1.0",
    info: { title: "Test API", version: "1.0.0" },
    paths: {
        "/users": {
            get: {
                operationId: "listUsers",
                responses: { "200": { description: "Success" } },
            },
            post: {
                operationId: "createUser",
                responses: { "201": { description: "Created" } },
            },
        },
    },
}


export const HEALTH_CHECK_OPERATION_SPEC: OpenAPIV3_1.Document = {
    openapi: "3.1.0",
    info: { title: "Test API", version: "1.0.0" },
    paths: {
        "/health": {
            get: {
                // No operationId
                responses: { "200": { description: "Healthy" } },
            },
        },
    },
}