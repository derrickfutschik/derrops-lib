import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { Module } from '@nestjs/common'
import { Client } from '@opensearch-project/opensearch'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import { OpenSearchMigrateCommand } from './opensearch.migrate.command'
import { OpenSearchService } from './opensearch.service'
import { config } from '@slaops/config'
import { TypescriptOSProxyClient } from 'opensearch-ts'

function createOpenSearchClient(): Client {
  const endpoint = config['opensearch.endpoint']
  const isLocal = endpoint.startsWith('http://')

  if (isLocal) {
    return new Client({ node: endpoint })
  }

  const region = config['aws.region']
  return new Client({
    ...AwsSigv4Signer({
      region,
      service: 'aoss', // OpenSearch Serverless
      getCredentials: () => {
        const credentialsProvider = defaultProvider()
        return credentialsProvider()
      },
    }),
    node: endpoint,
  })
}

@Module({
  providers: [
    {
      provide: Client,
      useFactory: createOpenSearchClient,
    },
    {
      provide: TypescriptOSProxyClient,
      useFactory: (client: Client) => new TypescriptOSProxyClient(client),
      inject: [Client],
    },

    OpenSearchService,
    OpenSearchMigrateCommand,
  ],
  exports: [TypescriptOSProxyClient, Client, OpenSearchService],
})
export class OpenSearchModule {}
