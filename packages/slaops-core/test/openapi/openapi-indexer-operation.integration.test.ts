import { CreateTableCommand, DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBRepo } from "../../src/openapi/repo/dynamodb-repo";
import { IndexedOperationDoc, IndexedServerDoc } from "../../src/openapi/openapi-types";
import { WELL_KNOWN_SPECS } from "../../../../test-resources/loader";
import { loadSpec } from "../../src/openapi/openapi-parser";
import { buildAPIIndex, buildOperationIndex } from "../../src/openapi/openapi-indexer";



describe("Operation Indexer", () => {

    const client = new DynamoDBClient({
        endpoint: "http://192.168.7.224:4566",
        region: 'us-east-1',
    })

    const repo = new DynamoDBRepo<IndexedOperationDoc>({
        client,
        tableName: 'operation-index',
        partitionKeyName: 'operation_id',
    })

    beforeEach(async () => {
        if (!await repo.tableExists()) {
            return repo.createTable()
        }
    })

    test('buildOperationIndex', async () => {
        const specPaths = Object.values(WELL_KNOWN_SPECS).map(path => path())
        const totalPaths = await Promise.all(specPaths.map(async (specPath) => {
            const spec = await loadSpec(specPath)
            const createdOperations = await buildOperationIndex(spec, repo)
            return createdOperations
        }))
        console.log({ totalPaths })
    })
})

