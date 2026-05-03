import { Module } from '@nestjs/common'
import { JwksCacheService } from '../auth/jwks-cache.service'
import { PlatformJwtGuard } from '../auth/platform-jwt.guard'
import { SqsRelayConsumerService } from '../queue/sqs-relay-consumer.service'
import { QueueService } from '../queue/queue.service'
import { CloudRelayController } from './cloud-relay.controller'
import { ProxyService } from './proxy.service'

@Module({
  controllers: [CloudRelayController],
  providers: [
    ProxyService,
    QueueService,
    SqsRelayConsumerService,
    JwksCacheService,
    PlatformJwtGuard,
  ],
  exports: [JwksCacheService, PlatformJwtGuard],
})
export class CloudRelayModule {}
