import * as dynamodb from '@aws-sdk/client-dynamodb'
import axios from 'axios'
import { attachSlaOpsInterceptor } from '../src'
import { AxiosHttpHandler } from './AxiosHttpHandler'
import { config } from '@slaops/config'

describe('aws smoke test', () => {
  const axiosInstance = axios.create()
  attachSlaOpsInterceptor(axiosInstance, {
    endpoint: 'http://localhost:3000',
    apiKey: 'test',
    projectId: 'test',
    listeners: [
      (events) => {
        console.log({ events })
        return Promise.resolve()
      },
    ],
  })

  const client = new dynamodb.DynamoDBClient({
    endpoint: config['dynamodb.endpoint'],
    region: 'us-east-1',
    requestHandler: new AxiosHttpHandler(axiosInstance, {}),
  })

  test('list tables', async () => {
    const tables = await client.send(new dynamodb.ListTablesCommand({}))
    console.log({ tables })

    client.destroy()
  })
})
