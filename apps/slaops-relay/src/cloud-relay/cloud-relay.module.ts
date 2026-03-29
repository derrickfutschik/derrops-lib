import { Module } from '@nestjs/common'
import { JwksCacheService } from '../auth/jwks-cache.service'
import { PlatformJwtGuard } from '../auth/platform-jwt.guard'
import { QueuePollerService } from '../queue/queue-poller.service'
import { SqsRelayConsumerService } from '../queue/sqs-relay-consumer.service'
import { QueueService } from '../queue/queue.service'
import { CloudRelayController } from './cloud-relay.controller'
import { ProxyService } from './proxy.service'

@Module({
  controllers: [CloudRelayController],
  providers: [
    ProxyService,
    QueueService,
    // SQS consumer (preferred): active when RELAY_PLATFORM_SQS_QUEUE_URL is set.
    // HTTP poller (fallback): active when RELAY_PLATFORM_URL + RELAY_PLATFORM_TOKEN are set.
    // Both are registered; each checks its own env vars in onModuleInit and self-disables if unconfigured.
    SqsRelayConsumerService,
    QueuePollerService,
    JwksCacheService,
    PlatformJwtGuard,
  ],
  exports: [JwksCacheService, PlatformJwtGuard],
})
export class CloudRelayModule {}
