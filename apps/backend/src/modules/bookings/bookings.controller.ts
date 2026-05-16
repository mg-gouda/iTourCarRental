import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto, CancelBookingDto, CheckinDto, CheckoutDto, QuoteDto } from './dto/booking.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly svc: BookingsService) {}

  @Post('quote')
  @RequirePermission('bookings.create')
  quote(@Body() dto: QuoteDto) {
    return this.svc.quote(dto);
  }

  @Get('calendar')
  @RequirePermission('calendar.view')
  calendar(@Query('from') from: string, @Query('to') to: string, @Query('branchId') branchId?: string) {
    return this.svc.calendar(from, to, branchId);
  }

  @Get()
  @RequirePermission('bookings.view')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('carId') carId?: string,
    @Query('customerId') customerId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({ page: page ? +page : 1, limit: limit ? +limit : 20, search, status, carId, customerId, branchId, from, to });
  }

  @Get(':id')
  @RequirePermission('bookings.view')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermission('bookings.create')
  create(@Body() dto: CreateBookingDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.svc.create(dto, userId);
  }

  @Patch(':id')
  @RequirePermission('bookings.edit')
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto, @Req() req: Request) {
    return this.svc.update(id, dto, (req as any).user?.id);
  }

  @Post(':id/confirm')
  @RequirePermission('bookings.edit')
  confirm(@Param('id') id: string, @Req() req: Request) {
    return this.svc.confirm(id, (req as any).user?.id);
  }

  @Post(':id/cancel')
  @RequirePermission('bookings.cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto, @Req() req: Request) {
    return this.svc.cancel(id, dto, (req as any).user?.id);
  }

  @Post(':id/checkin')
  @RequirePermission('bookings.edit')
  checkin(@Param('id') id: string, @Body() dto: CheckinDto, @Req() req: Request) {
    return this.svc.checkin(id, dto, (req as any).user?.id);
  }

  @Post(':id/checkout')
  @RequirePermission('bookings.edit')
  checkout(@Param('id') id: string, @Body() dto: CheckoutDto, @Req() req: Request) {
    return this.svc.checkout(id, dto, (req as any).user?.id);
  }

  @Delete(':id')
  @RequirePermission('bookings.delete')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }

  @Post(':id/drivers')
  @RequirePermission('bookings.edit')
  addDriver(
    @Param('id') id: string,
    @Body() dto: { fullName: string; age: number; phone?: string },
  ) {
    return this.svc.addDriver(id, dto);
  }

  @Delete(':id/drivers/:driverId')
  @RequirePermission('bookings.edit')
  removeDriver(@Param('id') id: string, @Param('driverId') driverId: string) {
    return this.svc.removeDriver(id, driverId);
  }
}
