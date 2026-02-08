import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { Module } from '@nestjs/common'
import { Client } from '@opensearch-project/opensearch'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import { OpenSearchMigrateCommand } from './opensearch.migrate.command'
import { OpenSearchService } from './opensearch.service'

import { config } from '@slaops/config'
import { TypescriptOSProxyClient } from 'opensearch-ts'

@Module({
  providers: [
    {
      provide: Client,
      useFactory: () => {
        const endpoint = config['opensearch.endpoint']
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
      },
    },
    {
      provide: TypescriptOSProxyClient,
      useFactory: (client: Client) => new TypescriptOSProxyClient(client),
    },

    OpenSearchService,
    OpenSearchMigrateCommand,
  ],
  exports: [TypescriptOSProxyClient, Client, OpenSearchService],
})
export class OpenSearchModule {}
