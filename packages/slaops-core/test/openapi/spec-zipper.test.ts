import { test, expect, describe } from '@jest/globals';
import { zipOperations } from "../../src/openapi/spec-zipper";
import type { OpenAPIV3_1 } from "openapi-types";

describe("zipOperations", () => {
    test("should return empty array for spec with no paths", () => {
        const spec: OpenAPIV3_1.Document = {
            openapi: "3.1.0",
            info: { title: "Empty API", version: "1.0.0" },
            components: {},
        };

        const result = zipOperations(spec);
        expect(result).toEqual([]);
    });

    test("should zip a simple operation", () => {
        const spec: OpenAPIV3_1.Document = {
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
        };

        const result = zipOperations(spec);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            o_i: "getUser",
            v_p: "/users/{i}",
            m: "G",
            m_i: [],
            p_k: "G:users/{i}",
        });
    });

    test("should handle multiple HTTP methods on same path", () => {
        const spec: OpenAPIV3_1.Document = {
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
        };

        const result = zipOperations(spec);

        expect(result).toHaveLength(2);
        expect(result.map(r => r.o_i)).toContain("listUsers");
        expect(result.map(r => r.o_i)).toContain("createUser");
        expect(result.map(r => r.m)).toContain("G");
        expect(result.map(r => r.m)).toContain("P");
    });

    test("should skip operations without operationId", () => {
        const spec: OpenAPIV3_1.Document = {
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
        };

        const result = zipOperations(spec);
        expect(result).toHaveLength(0);
    })
})