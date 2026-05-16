import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import {
  GenerateInvoiceDto,
  VoidInvoiceDto,
  CreateCreditNoteDto,
} from './dto/invoice.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  @Get()
  @RequirePermission('invoices.view')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('bookingId') bookingId?: string,
    @Query('branchId') branchId?: string,
    @Query('kind') kind?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      bookingId,
      branchId,
      kind,
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermission('invoices.view')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post('generate')
  @RequirePermission('invoices.create')
  generate(@Body() dto: GenerateInvoiceDto) {
    return this.svc.generate(dto);
  }

  @Post(':id/void')
  @RequirePermission('invoices.delete')
  void(@Param('id') id: string, @Body() dto: VoidInvoiceDto) {
    return this.svc.void(id, dto);
  }

  @Post(':id/credit-notes')
  @RequirePermission('invoices.create')
  issueCreditNote(@Param('id') id: string, @Body() dto: CreateCreditNoteDto) {
    return this.svc.issueCreditNote(id, dto);
  }

  @Get(':id/pdf')
  @RequirePermission('invoices.view')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  // PDF generation via Puppeteer/pdfkit is planned — stub returns 501 until implemented
  getPdf(@Param('id') _id: string) {
    return { message: 'PDF generation is not yet implemented', status: 501 };
  }
}
