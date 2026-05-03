import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OpenSearchModule } from '../opensearch/opensearch.module'
import { ApiController } from './api.controller'
import { ApiService } from './api.service'
import { ApiEntity } from './entities/api.entity'
import { PlatformStatsSyncScheduler } from './platform-stats-sync.scheduler'

@Module({
  imports: [TypeOrmModule.forFeature([ApiEntity]), OpenSearchModule],
  controllers: [ApiController],
  providers: [ApiService, PlatformStatsSyncScheduler],
  exports: [ApiService, PlatformStatsSyncScheduler],
})
export class ApiModule {}
