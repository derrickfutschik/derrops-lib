import { Module } from '@nestjs/common'
import { CedarModule } from '../cedar/cedar.module'
import { JwksModule } from '../jwks/jwks.module'
import { SessionController } from './session.controller'
import { SessionService } from './session.service'

@Module({
  imports: [JwksModule, CedarModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
