
import * as dynamodb from "@aws-sdk/client-dynamodb";
import { describe, it, expect } from '@jest/globals';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { attachSlaOpsInterceptor } from '@slaops/client-nodejs-axios';
import axios from 'axios';
import { AxiosHttpHandler } from "../../slaops-client-nodejs-axios/test/AxiosHttpHandler";

/**
 * This is a full end to end to end test of an AWS DynamoDB request being made, and an SLA Ops Log being created.
 * 
 * Limitations: 
 *  1. It will not feature API Matching, as this is not yet built.
 *  2. It will also not save the log to a database just yet.
 * 
 */
describe('AWS Full Example E2E', () => {

    const axiosInstance = axios.create();

    attachSlaOpsInterceptor(axiosInstance, {
        endpoint: 'http://localhost:3000',
        apiKey: 'test',
        projectId: 'test',
    })

    const client = new dynamodb.DynamoDBClient({
        endpoint: "http://192.168.7.224:4566",
        region: 'us-east-1',
        requestHandler: new AxiosHttpHandler(axiosInstance, {
        })
    });

    it('should create an SLA Ops Log for a DynamoDB request', async () => {
        const tables = await client.send(new dynamodb.ListTablesCommand({}));
        console.log({ tables });


    });

});