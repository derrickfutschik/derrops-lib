import { test, expect, describe } from '@jest/globals';
import { loadSpec } from '../../src/openapi/parser';
import { WELL_KNOWN_SPECS, resolveOpenApiSpec } from '../../../../test-resources/loader';

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