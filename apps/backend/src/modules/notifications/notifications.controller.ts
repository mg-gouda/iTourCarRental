import { Controller, Get, Post, Delete, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query('unread') unread?: string) {
    return this.svc.list(req.session.userId, unread === 'true');
  }

  @Get('unread-count')
  countUnread(@Req() req: any) {
    return this.svc.countUnread(req.session.userId);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.svc.markRead(id, req.session.userId);
  }

  @Post('read-all')
  markAllRead(@Req() req: any) {
    return this.svc.markAllRead(req.session.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.svc.delete(id, req.session.userId);
  }
}
