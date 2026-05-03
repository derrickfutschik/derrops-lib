import { Module } from '@nestjs/common'
import { JwksModule } from '../jwks/jwks.module'
import { RegistrationService } from './registration.service'

@Module({
  imports: [JwksModule],
  providers: [RegistrationService],
})
export class RegistrationModule {}
