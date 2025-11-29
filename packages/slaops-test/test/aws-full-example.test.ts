

import { describe, it, expect } from '@jest/globals';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { attachSlaOpsInterceptor } from '@slaops/client-nodejs-axios';


/**
 * This is a full end to end to end test of an AWS DynamoDB request being made, and an SLA Ops Log being created.
 * 
 * Limitations: 
 *  1. It will not feature API Matching, as this is not yet built.
 *  2. It will also not save the log to a database just yet.
 * 
 */

describe('AWS Full Example', () => {
    it('should create an SLA Ops Log for a DynamoDB request', async () => {
        console.log("TODO")
    });
});