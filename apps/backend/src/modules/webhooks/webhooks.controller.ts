import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { WebhooksService, CreateWebhookDto } from './webhooks.service';

@UseGuards(AuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  @Get() list() { return this.svc.list(); }

  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }

  @Get(':id/deliveries')
  deliveries(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.deliveries(id, Number(page ?? 1), Number(limit ?? 20));
  }

  @Post() create(@Body() dto: CreateWebhookDto) { return this.svc.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateWebhookDto> & { isActive?: boolean }) {
    return this.svc.update(id, dto);
  }

  @Delete(':id') delete(@Param('id') id: string) { return this.svc.delete(id); }
}
