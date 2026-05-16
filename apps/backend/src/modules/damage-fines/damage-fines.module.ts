import { Module } from '@nestjs/common';
import { DamageFinesController } from './damage-fines.controller';
import { DamageFinesService } from './damage-fines.service';

@Module({
  controllers: [DamageFinesController],
  providers: [DamageFinesService],
  exports: [DamageFinesService],
})
export class DamageFinesModule {}
