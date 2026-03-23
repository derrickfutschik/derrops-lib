import { Module } from '@nestjs/common'
import { JwksCacheService } from '../auth/jwks-cache.service'
import { PlatformJwtGuard } from '../auth/platform-jwt.guard'
import { QueuePollerService } from '../queue/queue-poller.service'
import { QueueService } from '../queue/queue.service'
import { CloudRelayController } from './cloud-relay.controller'
import { ProxyService } from './proxy.service'

@Module({
  controllers: [CloudRelayController],
  providers: [ProxyService, QueueService, QueuePollerService, JwksCacheService, PlatformJwtGuard],
  exports: [JwksCacheService, PlatformJwtGuard],
})
export class CloudRelayModule {}
