import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, VoidPaymentDto } from './dto/payment.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Get()
  @RequirePermission('payments.view')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('bookingId') bookingId?: string,
    @Query('kind') kind?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      bookingId,
      kind,
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermission('payments.view')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermission('payments.create')
  create(
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
    @Headers('idempotency-key') headerKey?: string,
  ) {
    const userId = (req as any).user?.id;
    // Allow idempotency key from header to override body field
    if (headerKey) dto.idempotencyKey = headerKey;
    if (!dto.idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header or body field is required');
    }
    return this.svc.create(dto, userId);
  }

  @Post(':id/void')
  @RequirePermission('payments.delete')
  void(@Param('id') id: string, @Body() dto: VoidPaymentDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.svc.void(id, dto, userId);
  }
}
