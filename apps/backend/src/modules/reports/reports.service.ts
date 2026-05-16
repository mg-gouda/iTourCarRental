import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ReportParams {
  from?: string;
  to?: string;
  branchId?: string;
  groupBy?: 'day' | 'month' | 'year';
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(params: ReportParams) {
    const from = params.from ? new Date(params.from) : new Date(new Date().getFullYear(), 0, 1);
    const to = params.to ? new Date(params.to) : new Date();
    return { from, to };
  }

  async summary(params: ReportParams) {
    const { from, to } = this.dateRange(params);
    const branchFilter = params.branchId ? { pickupBranchId: params.branchId } : {};

    const [
      totalBookings,
      activeBookings,
      totalRevenue,
      totalCars,
      rentedCars,
      inMaintenanceCars,
      activeMaintenance,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { deletedAt: null, ...branchFilter, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.booking.count({
        where: { deletedAt: null, status: 'ACTIVE', ...branchFilter },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { voidedAt: null, recordedAt: { gte: from, lte: to } },
      }),
      this.prisma.car.count({ where: { deletedAt: null } }),
      this.prisma.car.count({ where: { deletedAt: null, status: 'RENTED' } }),
      this.prisma.car.count({ where: { deletedAt: null, status: 'IN_MAINTENANCE' } }),
      this.prisma.maintenanceRecord.count({ where: { completedAt: null } }),
    ]);

    const availableCars = await this.prisma.car.count({ where: { deletedAt: null, status: 'AVAILABLE' } });

    return {
      totalBookings,
      activeBookings,
      totalRevenue: totalRevenue._sum.amount?.toNumber() ?? 0,
      totalCars,
      rentedCars,
      availableCars,
      inMaintenanceCars,
      activeMaintenance,
      fleetUtilizationPct: totalCars > 0 ? Math.round((rentedCars / totalCars) * 100) : 0,
    };
  }

  async revenue(params: ReportParams) {
    const { from, to } = this.dateRange(params);
    const groupBy = params.groupBy ?? 'month';
    const fmt = groupBy === 'day' ? 'YYYY-MM-DD' : groupBy === 'month' ? 'YYYY-MM' : 'YYYY';

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT to_char(recorded_at, '${fmt}') AS period,
              SUM(amount)::float AS total,
              COUNT(*)::int AS count
       FROM payments
       WHERE voided_at IS NULL
         AND recorded_at >= $1
         AND recorded_at <= $2
       GROUP BY period
       ORDER BY period`,
      from,
      to,
    )) as Array<{ period: string; total: number; count: number }>;

    return rows;
  }

  async bookingsByStatus(params: ReportParams) {
    const { from, to } = this.dateRange(params);
    const branchFilter = params.branchId ? `AND pickup_branch_id = '${params.branchId}'` : '';

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT status, COUNT(*)::int AS count
       FROM bookings
       WHERE deleted_at IS NULL
         AND created_at >= $1
         AND created_at <= $2
         ${branchFilter}
       GROUP BY status
       ORDER BY count DESC`,
      from,
      to,
    )) as Array<{ status: string; count: number }>;

    return rows;
  }

  async fleetUtilization() {
    const rows = (await this.prisma.$queryRaw`
      SELECT cc.name AS category,
             COUNT(c.id)::int AS total,
             SUM(CASE WHEN c.status = 'RENTED' THEN 1 ELSE 0 END)::int AS rented,
             ROUND(
               SUM(CASE WHEN c.status = 'RENTED' THEN 1 ELSE 0 END)::numeric
               / NULLIF(COUNT(c.id), 0) * 100
             , 1)::float AS utilization
      FROM cars c
      JOIN car_categories cc ON c.category_id = cc.id
      WHERE c.deleted_at IS NULL
      GROUP BY cc.name
      ORDER BY utilization DESC
    `) as Array<{ category: string; total: number; rented: number; utilization: number }>;

    return rows;
  }

  async maintenanceCosts(params: ReportParams) {
    const { from, to } = this.dateRange(params);

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT CONCAT(c.make, ' ', c.model, ' (', c.year::text, ')') AS car,
              c.license_plate AS "licensePlate",
              SUM(m.cost)::float AS "totalCost",
              COUNT(m.id)::int AS records
       FROM maintenance_records m
       JOIN cars c ON m.car_id = c.id
       WHERE m.started_at >= $1 AND m.started_at <= $2
       GROUP BY c.id, c.make, c.model, c.year, c.license_plate
       ORDER BY "totalCost" DESC
       LIMIT 10`,
      from,
      to,
    )) as Array<{ car: string; licensePlate: string; totalCost: number; records: number }>;

    return rows;
  }

  async topCustomers(params: ReportParams) {
    const { from, to } = this.dateRange(params);

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT cu.full_name AS customer,
              cu.email AS email,
              COUNT(b.id)::int AS bookings,
              SUM(p.amount)::float AS "totalSpent"
       FROM customers cu
       JOIN bookings b ON b.customer_id = cu.id
       JOIN payments p ON p.booking_id = b.id
       WHERE cu.deleted_at IS NULL
         AND b.deleted_at IS NULL
         AND p.voided_at IS NULL
         AND p.recorded_at >= $1
         AND p.recorded_at <= $2
       GROUP BY cu.id, cu.full_name, cu.email
       ORDER BY "totalSpent" DESC
       LIMIT 10`,
      from,
      to,
    )) as Array<{ customer: string; email: string; bookings: number; totalSpent: number }>;

    return rows;
  }

  async staffActivity(params: ReportParams) {
    const { from, to } = this.dateRange(params);
    const branchFilter = params.branchId ? `AND b.pickup_branch_id = '${params.branchId}'` : '';

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT u.full_name AS staff,
              u.email AS email,
              COUNT(DISTINCT b.id)::int AS "bookingsCreated",
              COUNT(DISTINCT p.id)::int AS "paymentsRecorded"
       FROM users u
       LEFT JOIN bookings b ON b.created_by_id = u.id
         AND b.deleted_at IS NULL
         AND b.created_at >= $1 AND b.created_at <= $2
         ${branchFilter}
       LEFT JOIN payments p ON p.recorded_by_id = u.id
         AND p.recorded_at >= $1 AND p.recorded_at <= $2
       WHERE u.deleted_at IS NULL AND u.is_active = true
       GROUP BY u.id, u.full_name, u.email
       ORDER BY "bookingsCreated" DESC
       LIMIT 20`,
      from,
      to,
    )) as Array<{ staff: string; email: string; bookingsCreated: number; paymentsRecorded: number }>;

    return rows;
  }
}
