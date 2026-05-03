import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AegisInstanceController } from './aegis-instance.controller'
import { AegisInstanceService } from './aegis-instance.service'
import { AegisRegisterController } from './aegis-register.controller'
import { AegisInstance } from './entities/aegis-instance.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AegisInstance])],
  controllers: [AegisInstanceController, AegisRegisterController],
  providers: [AegisInstanceService],
  exports: [AegisInstanceService],
})
export class AegisInstanceModule {}
