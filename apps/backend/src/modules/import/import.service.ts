import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

function parseCSV(buffer: Buffer): Array<Record<string, string>> {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importCars(buffer: Buffer) {
    const rows = parseCSV(buffer);
    if (!rows.length) throw new BadRequestException('No data rows found');

    const required = ['make', 'model', 'year', 'licensePlate', 'vin'];
    const missing = required.filter((f) => !(f in rows[0]));
    if (missing.length) throw new BadRequestException(`Missing columns: ${missing.join(', ')}`);

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const category = await this.prisma.carCategory.findFirst({
          where: { name: { contains: row.category || 'Standard', mode: 'insensitive' } },
        });
        const branch = await this.prisma.branch.findFirst({
          where: { OR: [{ code: row.branchCode }, { name: row.branchName }], isActive: true },
        });

        if (!category || !branch) {
          results.errors.push(`Row ${row.licensePlate}: category/branch not found`);
          results.skipped++;
          continue;
        }

        const exists = await this.prisma.car.findFirst({
          where: { OR: [{ licensePlate: row.licensePlate }, { vin: row.vin }] },
        });
        if (exists) { results.skipped++; continue; }

        await this.prisma.car.create({
          data: {
            make: row.make,
            model: row.model,
            year: parseInt(row.year, 10),
            licensePlate: row.licensePlate,
            vin: row.vin,
            categoryId: category.id,
            homeBranchId: branch.id,
            transmission: (row.transmission?.toUpperCase() as any) || 'AUTOMATIC',
            fuelType: (row.fuelType?.toUpperCase() as any) || 'PETROL',
            seats: parseInt(row.seats, 10) || 5,
            currentMileage: parseInt(row.mileage, 10) || 0,
            status: 'AVAILABLE',
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`Row ${row.licensePlate}: ${e.message}`);
        results.skipped++;
      }
    }

    return results;
  }

  async importCustomers(buffer: Buffer) {
    const rows = parseCSV(buffer);
    if (!rows.length) throw new BadRequestException('No data rows found');

    const required = ['fullName', 'email', 'phone'];
    const missing = required.filter((f) => !(f in rows[0]));
    if (missing.length) throw new BadRequestException(`Missing columns: ${missing.join(', ')}`);

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const exists = await this.prisma.customer.findFirst({
          where: { OR: [{ email: row.email }, { phone: row.phone }], deletedAt: null },
        });
        if (exists) { results.skipped++; continue; }

        const validFlags = ['BLACKLISTED', 'WATCHLIST', 'VIP'];
        const flag = validFlags.includes(row.flag?.toUpperCase()) ? row.flag.toUpperCase() as any : undefined;
        await this.prisma.customer.create({
          data: {
            fullName: row.fullName,
            email: row.email,
            phone: row.phone,
            nationality: row.nationality || null,
            source: 'ADMIN_CREATED',
            ...(flag ? { flag } : {}),
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`Row ${row.email}: ${e.message}`);
        results.skipped++;
      }
    }

    return results;
  }
}
