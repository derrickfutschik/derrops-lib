import { Module } from '@nestjs/common'
import { VendorJwtService } from './vendor-jwt.service'

@Module({
  providers: [VendorJwtService],
  exports: [VendorJwtService],
})
export class VendorJwtModule {}
