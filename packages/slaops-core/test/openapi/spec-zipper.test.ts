import { test, expect, describe } from '@jest/globals';
import { zipOperations } from "../../src/openapi/spec-zipper";
import type { OpenAPIV3_1 } from "openapi-types";
import * as fixture from './spec-zipper.fixture';

describe("zipOperations", () => {
    test("should return empty array for spec with no paths", () => {
        const spec = fixture.EMPTY_OPERATION_SPEC;

        const result = zipOperations(spec);
        expect(result).toEqual([]);
    });

    test("should zip a simple operation", () => {
        const spec = fixture.SINGLE_OPERATION_SPEC_GET_USER
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
        const spec = fixture.LIST_USERS_OPERATION_SPEC

        const result = zipOperations(spec);

        expect(result).toHaveLength(2);
        expect(result.map(r => r.o_i)).toContain("listUsers");
        expect(result.map(r => r.o_i)).toContain("createUser");
        expect(result.map(r => r.m)).toContain("G");
        expect(result.map(r => r.m)).toContain("P");
    });

    test("should skip operations without operationId", () => {
        const spec = fixture.HEALTH_CHECK_OPERATION_SPEC
        const result = zipOperations(spec);
        expect(result).toHaveLength(0);
    })
})