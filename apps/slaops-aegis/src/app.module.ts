import { Module } from '@nestjs/common'
import { EntitlementModule } from './entitlement/entitlement.module'
import { JwksModule } from './jwks/jwks.module'
import { RegistrationModule } from './registration/registration.module'
import { SessionModule } from './session/session.module'

@Module({
  imports: [JwksModule, SessionModule, EntitlementModule, RegistrationModule],
})
export class AppModule {}
