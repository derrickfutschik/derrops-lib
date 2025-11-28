import { loadSpec } from '../../src/openapi/openapi-parser';
import { zipOperations } from '../../src/openapi/openapi-spec-zipper';

import { WELL_KNOWN_SPECS } from '../../../../test-resources/loader';

test("zipping a test resource", async () => {
    const specPath = WELL_KNOWN_SPECS.ably();
    const spec = await loadSpec(specPath);
    const operationsZipped = zipOperations(spec)
    expect(operationsZipped.length).toBeGreaterThan(0);
});
