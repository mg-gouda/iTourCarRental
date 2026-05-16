import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/refund.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('refunds')
export class RefundsController {
  constructor(private readonly svc: RefundsService) {}

  @Get()
  @RequirePermission('bookings.refund')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('bookingId') bookingId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      bookingId,
      status,
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermission('bookings.refund')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermission('bookings.refund')
  create(@Body() dto: CreateRefundDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.svc.create(dto, userId);
  }

  @Post(':id/approve')
  @RequirePermission('bookings.refund')
  approve(@Param('id') id: string, @Req() req: Request) {
    const approverId = (req as any).user?.id;
    return this.svc.approve(id, approverId);
  }

  @Post(':id/reject')
  @RequirePermission('bookings.refund')
  reject(@Param('id') id: string, @Req() req: Request) {
    const rejectorId = (req as any).user?.id;
    return this.svc.reject(id, rejectorId);
  }

  @Post(':id/mark-paid')
  @RequirePermission('bookings.refund')
  markPaid(@Param('id') id: string) {
    return this.svc.markPaid(id);
  }
}
