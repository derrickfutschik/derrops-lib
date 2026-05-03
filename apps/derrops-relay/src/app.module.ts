import { Module } from '@nestjs/common'
import { JwksCacheService } from './auth/jwks-cache.service'
import { PlatformJwtGuard } from './auth/platform-jwt.guard'
import { CloudRelayModule } from './cloud-relay/cloud-relay.module'
import { HealthController } from './health/health.controller'

@Module({
  imports: [CloudRelayModule],
  controllers: [HealthController],
  providers: [JwksCacheService, PlatformJwtGuard],
})
export class AppModule {}
