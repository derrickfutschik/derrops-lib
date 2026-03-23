import { Module } from '@nestjs/common'
import { JwksModule } from '../jwks/jwks.module'
import { SessionController } from './session.controller'
import { SessionService } from './session.service'

@Module({
  imports: [JwksModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
