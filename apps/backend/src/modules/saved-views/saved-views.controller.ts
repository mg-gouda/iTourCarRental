import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SavedViewsService, SaveViewDto } from './saved-views.service';

@UseGuards(AuthGuard)
@Controller('saved-views')
export class SavedViewsController {
  constructor(private readonly svc: SavedViewsService) {}

  @Get()
  list(@Req() req: any, @Query('page') page: string) {
    return this.svc.listForPage(req.session.userId, page);
  }

  @Post()
  save(@Req() req: any, @Body() dto: SaveViewDto) {
    return this.svc.save(req.session.userId, dto);
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string, @Req() req: any) {
    return this.svc.setDefault(id, req.session.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.svc.delete(id, req.session.userId);
  }
}
