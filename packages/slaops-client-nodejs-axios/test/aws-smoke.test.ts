import * as dynamodb from "@aws-sdk/client-dynamodb";
import { AxiosHttpHandler } from "./AxiosHttpHandler";
import axios from "axios"
import { attachSlaOpsInterceptor } from "../src";

// This test requires a DynamoDB instance running at 192.168.7.224:4566
describe('aws smoke test', () => {

    const axiosInstance = axios.create();
    attachSlaOpsInterceptor(axiosInstance, {
        endpoint: 'http://localhost:3000',
        apiKey: 'test',
        projectId: 'test',
        listeners: [(events) => {
            console.log({ events });
            return Promise.resolve();
        }]
    })

    const client = new dynamodb.DynamoDBClient({
        endpoint: "http://192.168.7.224:4566",
        region: 'us-east-1',
        requestHandler: new AxiosHttpHandler(axiosInstance, {
        })
    });

    test("list tables", async () => {


        const tables = await client.send(new dynamodb.ListTablesCommand({}));
        console.log({ tables });

        client.destroy();
    })
})