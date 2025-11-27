import { CreateTableCommand, DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBRepo } from "../../src/openapi/repo/dynamodb-repo";
import { IndexedServerDoc } from "../../src/openapi/openapi-types";
import { WELL_KNOWN_SPECS } from "../../../../test-resources/loader";
import { loadSpec } from "../../src/openapi/parser";
import { buildAPIIndex } from "../../src/openapi/openapi-indexer";



test("list tables", async () => {
    const client = new DynamoDBClient({
        endpoint: "http://192.168.7.224:4566",
        region: 'us-east-1',
    });
    const tables = await client.send(new ListTablesCommand({}));
    console.log(tables);
})

test("create table", async () => {
    const client = new DynamoDBClient({
        endpoint: "http://192.168.7.224:4566",
        region: 'us-east-1',
    });
    const tables = await client.send(new CreateTableCommand({
        TableName: 'server-index',
        AttributeDefinitions: [
            {
                AttributeName: 'host_template',
                AttributeType: 'S',
            },
            {
                AttributeName: 'base_path',
                AttributeType: 'S',
            },
        ],
        KeySchema: [
            {
                AttributeName: 'host_template',
                KeyType: 'HASH',
            },
            {
                AttributeName: 'base_path',
                KeyType: 'RANGE',
            },
        ],
        BillingMode: 'PAY_PER_REQUEST',
    }));
})


test('buildAPIIndex', async () => {

    const serverRepo = new DynamoDBRepo<IndexedServerDoc>({
        client: new DynamoDBClient({
            endpoint: "http://192.168.7.224:4566",
            region: 'us-east-1',
        }),
        tableName: 'server-index',
        partitionKeyName: 'host_template',
    })

    const specPaths = Object.values(WELL_KNOWN_SPECS).map(path => path())

    const totalPaths = await Promise.all(specPaths.map(async (specPath) => {
        const spec = await loadSpec(specPath)
        const createdServers = await buildAPIIndex(spec, serverRepo)
        return createdServers
    }))

    console.log(totalPaths);

}

)