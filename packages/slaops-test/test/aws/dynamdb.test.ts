
import * as dynamodb from "@aws-sdk/client-dynamodb";
import { describe, it, expect } from '@jest/globals';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { attachSlaOpsInterceptor } from '@slaops/client-nodejs-axios';
import axios from 'axios';
import { AxiosHttpHandler } from "../../../slaops-client-nodejs-axios/test/AxiosHttpHandler";
import { matchPath } from "../../../slaops-private/src/openapi/match/OpenAPIUtil";
import { loadSpec } from "../../../slaops-private/src/openapi/openapi-parser";
import { TEST_API_SPECS } from "../../../../test-resources/loader";
import { HarEntry, HarLogListener } from "@slaops/public";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

/**
 * This is a full end to end to end test of an AWS DynamoDB request being made, and an SLA Ops Log being created.
 * 
 * Limitations: 
 *  1. It will not feature API Matching, as this is not yet built.
 *  2. It will also not save the log to a database just yet.
 * 
 */
describe('AWS DynamoDB', () => {


    var openapiSpec: OpenAPIV3_1.Document

    beforeAll(async () => {
        openapiSpec = await loadSpec(TEST_API_SPECS.awsDynamoDB())
    })


    it('should create an SLA Ops Log for a DynamoDB request', async () => {


        const axiosInstance = axios.create();

        // Track pending listener promises to ensure they complete before test ends
        let pendingListenerPromise: Promise<void> | null = null;

        const listener: HarLogListener = async (logs: HarEntry[]) => {
            return Promise.all(logs.map(log => {

                console.log({ log });

                const operation = matchPath({
                    path: new URL(log.request.url).pathname,
                    method: log.request.method as OpenAPIV3.HttpMethods,
                }, openapiSpec)

                console.log({ operation });


            })).then(() => {
                console.log('done');
            })
        }

        attachSlaOpsInterceptor(axiosInstance, {
            listeners: [(events) => {
                pendingListenerPromise = listener(events);
                return pendingListenerPromise;
            }],
            endpoint: 'http://localhost:3000'
        })

        // attachSlaOpsInterceptor(axiosInstance, {
        //     listeners: [(events) => listener(events)]
        // })


        const client = new dynamodb.DynamoDBClient({
            endpoint: "http://192.168.7.224:4566",
            region: 'us-east-1',
            requestHandler: new AxiosHttpHandler(axiosInstance, {
            })
        });

        const tables = await client.send(new dynamodb.ListTablesCommand({}));
        console.log({ tables });


    });

});