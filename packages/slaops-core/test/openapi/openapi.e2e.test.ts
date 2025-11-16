import { loadSpec } from '../../src/openapi/parser';
import { zipOperations } from '../../src/openapi/spec-zipper';

import { WELL_KNOWN_SPECS, resolveOpenApiSpec } from '../../../../test-resources/loader';

test.skip("zipping a test resource", async () => {
    const specPath = WELL_KNOWN_SPECS.ably();
    const spec = await loadSpec(specPath);
    const operationsZipped = zipOperations(spec)
    console.log(JSON.stringify({ operationsZipped }, null, 2));
    expect(operationsZipped.length).toBeGreaterThan(0);
});
