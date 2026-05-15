import { Module } from '@nestjs/common';
import { StylingController } from './styling.controller';
import { StylingService } from './styling.service';

@Module({
  controllers: [StylingController],
  providers: [StylingService],
  exports: [StylingService],
})
export class StylingModule {}
