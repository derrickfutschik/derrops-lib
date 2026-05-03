import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { VendorJwtModule } from '../vendor-jwt/vendor-jwt.module'
import { CloudRelayController } from './cloud-relay.controller'
import { CloudRelayService } from './cloud-relay.service'
import { CloudRelayConnection } from './entities/cloud-relay-connection.entity'
import { CloudRelayJob } from './entities/cloud-relay-job.entity'
import { RelayQueueService } from './relay-queue.service'
import { RelayConnectionGuard } from './relay-connection.guard'

@Module({
  imports: [TypeOrmModule.forFeature([CloudRelayConnection, CloudRelayJob]), VendorJwtModule],
  controllers: [CloudRelayController],
  providers: [CloudRelayService, RelayQueueService, RelayConnectionGuard],
  exports: [CloudRelayService],
})
export class CloudRelayModule {}
