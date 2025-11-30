
import * as s3 from "@aws-sdk/client-s3";
import { describe, it, expect } from '@jest/globals';
import { attachSlaOpsInterceptor } from '@slaops/client-nodejs-axios';
import axios from 'axios';
import { AxiosHttpHandler } from "../../../slaops-client-nodejs-axios/test/AxiosHttpHandler";
import { matchPath } from "../../../slaops-private/src/openapi/match/OpenAPIUtil";
import { loadSpec } from "../../../slaops-private/src/openapi/openapi-parser";
import { WELL_KNOWN_SPECS } from "../../../../test-resources/loader";
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
describe('AWS S3', () => {


    var openapiSpec: OpenAPIV3_1.Document

    beforeAll(async () => {
        openapiSpec = await loadSpec(WELL_KNOWN_SPECS.awsS3())
    })


    it('AWS S3 Full Example', async () => {


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


        const client = new s3.S3Client({
            endpoint: "http://192.168.7.224:4566",
            region: 'us-east-1',
            requestHandler: new AxiosHttpHandler(axiosInstance, {
            })
        });

        const buckets = await client.send(new s3.ListObjectVersionsCommand({
            Bucket: "bucket-bar",
            Prefix: "prefix-bar"
        }));
        console.log({ buckets });


    });

});