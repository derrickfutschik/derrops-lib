import { OpenAPIV3_1 } from 'openapi-types';
import { ensureOperationIds, getHttpMethodOperations, loadSpec } from '../../src/openapi/parser';

import { OPERATION_WITH_NO_ID } from './spec-zipper.fixture';

test("should ensureOperationIds is populating all operations with an operationId", async () => {
    const spec = ensureOperationIds(OPERATION_WITH_NO_ID)
    Object.entries(spec.paths!).forEach(([pathKey, path]) => {
        if (!path) return;
        for (const [method, operation] of getHttpMethodOperations(path)) {
            expect(operation.operationId).toBeDefined();
        }
    })
})