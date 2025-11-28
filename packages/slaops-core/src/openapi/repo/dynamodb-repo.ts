import * as dynamodb from "@aws-sdk/client-dynamodb";


import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Repository } from "./repo";

export interface DynamoDBRepoConfig {
    client: dynamodb.DynamoDBClient;
    tableName: string;
    partitionKeyName: string;
    sortKeyName?: string;
}

export class DynamoDBRepo<T extends Record<string, any>, ID = string> implements Repository<T, ID> {

    private client: dynamodb.DynamoDBClient;
    private tableName: string;
    private partitionKeyName: string;
    private sortKeyName?: string;

    constructor(config: DynamoDBRepoConfig) {
        this.client = config.client;
        this.tableName = config.tableName;
        this.partitionKeyName = config.partitionKeyName;
        this.sortKeyName = config.sortKeyName;
    }

    async tableExists(): Promise<boolean> {

        try {
            const command = new dynamodb.DescribeTableCommand({
                TableName: this.tableName,
            });
            const response = await this.client.send(command)
            return response.Table !== undefined;
        } catch (error) {
            return false
        }

    }

    async createTable() {
        const table = await this.client.send(new dynamodb.CreateTableCommand({
            TableName: this.tableName,
            AttributeDefinitions: [
                {
                    AttributeName: this.partitionKeyName,
                    AttributeType: 'S',
                },
                {
                    AttributeName: this.sortKeyName,
                    AttributeType: 'S',
                },
            ],
            KeySchema: [
                {
                    AttributeName: this.partitionKeyName,
                    KeyType: 'HASH',
                },
                {
                    AttributeName: this.sortKeyName,
                    KeyType: 'RANGE',
                },
            ],
            BillingMode: 'PAY_PER_REQUEST',
        }));

        return table
    }

    async createMany(entities: T[]): Promise<number> {

        const command = new dynamodb.BatchWriteItemCommand({
            RequestItems: {
                [this.tableName]: entities.map(entity => ({
                    PutRequest: {
                        Item: marshall(entity),
                    },
                })),
            },
        })

        const response = await this.client.send(command)

        return entities.length - (response.UnprocessedItems?.[this.tableName]?.length ?? 0)


    }

    async findById(id: ID): Promise<T | null> {
        const key = this.buildKey(id);

        const command = new dynamodb.GetItemCommand({
            TableName: this.tableName,
            Key: marshall(key),
        });

        const response = await this.client.send(command);

        if (!response.Item) {
            return null;
        }

        return unmarshall(response.Item) as T;
    }

    async create(entity: T): Promise<T> {
        const command = new dynamodb.PutItemCommand({
            TableName: this.tableName,
            Item: marshall(entity, { removeUndefinedValues: true }),
        });

        await this.client.send(command);
        return entity;
    }

    async update(id: ID, updates: Partial<T>): Promise<T> {
        // First get the existing entity
        const existing = await this.findById(id);
        if (!existing) {
            throw new Error(`Entity with id ${id} not found`);
        }

        // Merge updates with existing entity
        const updated = { ...existing, ...updates };

        // Put the updated entity
        const command = new dynamodb.PutItemCommand({
            TableName: this.tableName,
            Item: marshall(updated, { removeUndefinedValues: true }),
        });

        await this.client.send(command);
        return updated;
    }

    async delete(id: ID): Promise<void> {
        const key = this.buildKey(id);

        const command = new dynamodb.DeleteItemCommand({
            TableName: this.tableName,
            Key: marshall(key),
        });

        await this.client.send(command);
    }

    async exists(id: ID): Promise<boolean> {
        const entity = await this.findById(id);
        return entity !== null;
    }

    /**
     * Builds the key object for DynamoDB operations
     * Handles both simple partition key and composite partition+sort key
     */
    private buildKey(id: ID): Record<string, any> {
        if (this.sortKeyName) {
            // For composite keys, expect ID to be an object with both keys
            if (typeof id === "object" && id !== null) {
                const idObj = id as any;
                return {
                    [this.partitionKeyName]: idObj[this.partitionKeyName],
                    [this.sortKeyName]: idObj[this.sortKeyName],
                };
            }
            throw new Error(
                `ID must be an object with ${this.partitionKeyName} and ${this.sortKeyName} for composite key table`
            );
        }

        // Simple partition key
        return {
            [this.partitionKeyName]: id,
        };
    }
}