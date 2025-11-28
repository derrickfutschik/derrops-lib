import { getHttpMethodOperations, loadSpec } from '../../src/openapi/openapi-parser';
import { WELL_KNOWN_SPECS, resolveOpenApiSpec } from '../../../../test-resources/loader';
import { OpenAPIV3_1 } from 'openapi-types';



test("should ensureOperationIds is populating all operations with an operationId", async () => {
    const specPath = WELL_KNOWN_SPECS.ably();
    const spec = await loadSpec(specPath);
    expect(spec).toBeDefined();
    expect(spec.paths).toBeDefined();
    Object.values(spec.paths!).forEach((path) => {
        if (!path) return;
        for (const [method, operation] of getHttpMethodOperations(path)) {
            if (operation) {
                expect(operation.operationId).toBeDefined();
            }
        }
    });
});

test("should load a spec from a file", async () => {
    const specPath = WELL_KNOWN_SPECS.ably();
    const spec = await loadSpec(specPath);
    expect(spec).toBeDefined();
    expect(spec.info).toBeDefined();
});

test("should load a spec using resolveOpenApiSpec", async () => {
    const specPath = resolveOpenApiSpec('ably.net', 'control', 'v1');
    const spec = await loadSpec(specPath);

    expect(spec).toBeDefined();
    expect(spec.info).toBeDefined();
});