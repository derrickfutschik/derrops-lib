import { Module } from '@nestjs/common'
import { CedarPolicyService } from './cedar-policy.service'

@Module({
  providers: [CedarPolicyService],
  exports:   [CedarPolicyService],
})
export class CedarModule {}
