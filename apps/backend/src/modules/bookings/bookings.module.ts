import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingService } from './pricing.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, PricingService],
  exports: [BookingsService, PricingService],
})
export class BookingsModule {}
