import { Module } from '@nestjs/common'
import { JwksController } from './jwks.controller'
import { SigningKeyService } from './signing-key.service'

@Module({
  controllers: [JwksController],
  providers: [SigningKeyService],
  exports: [SigningKeyService],
})
export class JwksModule {}
