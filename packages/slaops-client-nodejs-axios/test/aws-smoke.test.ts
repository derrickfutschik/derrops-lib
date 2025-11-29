import * as dynamodb from "@aws-sdk/client-dynamodb";
import { AxiosHttpHandler } from "./AxiosHttpHandler";

// This test requires a DynamoDB instance running at 192.168.7.224:4566
describe('aws smoke test', () => {
    test("list tables", async () => {
        const client = new dynamodb.DynamoDBClient({
            endpoint: "http://192.168.7.224:4566",
            region: 'us-east-1',
            requestHandler: new AxiosHttpHandler({})
        });

        const tables = await client.send(new dynamodb.ListTablesCommand({}));
        console.log({ tables });

        client.destroy();
    })
})