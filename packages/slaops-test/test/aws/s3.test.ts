
import * as s3 from "@aws-sdk/client-s3";
import { describe, it, expect } from '@jest/globals';
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
describe('AWS S3', () => {


    var openapiSpec: OpenAPIV3_1.Document

    const s3BucketName = "bucket-bar"
    const s3Prefix = "prefix-bar"

    const axiosInstance = axios.create();

    const listener: HarLogListener = async (logs: HarEntry[]) => {
        return Promise.all(logs.map(log => {

            // console.log(JSON.stringify(log, null, 2));

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
        endpoint: 'http://localhost:3000',
        listeners: [listener]
    },

    )

    const client = new s3.S3Client({
        endpoint: "http://192.168.7.224:4566",
        region: 'us-east-1',
        requestHandler: new AxiosHttpHandler(axiosInstance, {
        })
    });

    beforeAll(async () => {
        openapiSpec = await loadSpec(TEST_API_SPECS.awsS3())

        if (await client.send(new s3.HeadBucketCommand({ Bucket: s3BucketName })).then(() => true).catch(() => false)) {
            console.log("Bucket already exists")
            return
        } else {
            console.log("Bucket does not exist, creating it")
            await client.send(new s3.CreateBucketCommand({
                Bucket: s3BucketName,
            })).catch(err => console.log("Bucket already exists"))
        }

    })


    it('AWS S3 List ', async () => {
        const buckets = await client.send(new s3.ListObjectVersionsCommand({
            Bucket: s3BucketName,
            // Prefix: s3Prefix
        })).catch(err => console.log("Not found"))


    });

});