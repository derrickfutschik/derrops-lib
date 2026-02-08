import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';


// TODO - only export this controller in non prod
@Module({
    controllers: [ConfigController],
})
export class SLAConfigModule { }
