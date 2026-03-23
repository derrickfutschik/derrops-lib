import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { VendorJwtModule } from '../vendor-jwt/vendor-jwt.module'
import { RelayInstance } from './entities/relay-instance.entity'
import { RelayInstanceController } from './relay-instance.controller'
import { RelayInstanceService } from './relay-instance.service'

@Module({
  imports: [TypeOrmModule.forFeature([RelayInstance]), VendorJwtModule],
  controllers: [RelayInstanceController],
  providers: [RelayInstanceService],
  exports: [RelayInstanceService],
})
export class RelayInstanceModule {}
