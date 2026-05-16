import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ApiKeysService } from './api-keys.service';

@UseGuards(AuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get() list() { return this.svc.list(); }

  @Post()
  create(@Body() dto: { name: string; scopes: string[] }, @Req() req: any) {
    return this.svc.create(dto.name, dto.scopes ?? [], req.session.userId);
  }

  @Delete(':id') revoke(@Param('id') id: string) { return this.svc.revoke(id); }
}
