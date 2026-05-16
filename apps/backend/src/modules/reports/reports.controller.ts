import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ReportsService, ReportParams } from './reports.service';

@UseGuards(AuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  private params(q: any): ReportParams {
    return { from: q.from, to: q.to, branchId: q.branchId, groupBy: q.groupBy };
  }

  @Get('summary')
  summary(@Query() q: any) { return this.svc.summary(this.params(q)); }

  @Get('revenue')
  revenue(@Query() q: any) { return this.svc.revenue(this.params(q)); }

  @Get('bookings-by-status')
  bookingsByStatus(@Query() q: any) { return this.svc.bookingsByStatus(this.params(q)); }

  @Get('fleet-utilization')
  fleetUtilization() { return this.svc.fleetUtilization(); }

  @Get('maintenance-costs')
  maintenanceCosts(@Query() q: any) { return this.svc.maintenanceCosts(this.params(q)); }

  @Get('top-customers')
  topCustomers(@Query() q: any) { return this.svc.topCustomers(this.params(q)); }

  @Get('staff-activity')
  staffActivity(@Query() q: any) { return this.svc.staffActivity(this.params(q)); }
}
