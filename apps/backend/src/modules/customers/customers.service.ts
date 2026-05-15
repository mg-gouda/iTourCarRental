import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto, AdditionalDriverDto, DriverLicenseDto } from './dto/customer.dto';
import { Prisma } from '@prisma/client';

const CUSTOMER_SELECT = {
  id: true, fullName: true, email: true, phone: true,
  address: true, nationality: true, dateOfBirth: true,
  source: true, flag: true, flagReason: true,
  internalNotes: true, visibleNotes: true,
  createdAt: true, updatedAt: true,
  corporateAccount: { select: { id: true, name: true } },
  licenses: { where: { additionalDriverId: null }, take: 1 },
  _count: { select: { bookings: { where: { deletedAt: null } } } },
};

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    page: number; limit: number; search?: string;
    flag?: string; corporateAccountId?: string;
  }) {
    const { page, limit, search, flag, corporateAccountId } = params;
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(flag && { flag: flag as any }),
      ...(corporateAccountId && { corporateAccountId }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where, select: CUSTOMER_SELECT,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        corporateAccount: { select: { id: true, name: true } },
        licenses: true,
        tags: { include: { tag: true } },
        bookings: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, status: true, startAt: true, endAt: true, createdAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(dto: CreateCustomerDto) {
    const { primaryLicense, ...customerData } = dto;
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          ...customerData,
          dateOfBirth: customerData.dateOfBirth ? new Date(customerData.dateOfBirth) : undefined,
        },
      });
      if (primaryLicense) {
        await tx.driverLicense.create({
          data: {
            customerId: customer.id,
            ...primaryLicense,
            expiryDate: new Date(primaryLicense.expiryDate),
          },
        });
      }
      return this.findOne(customer.id);
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
      select: CUSTOMER_SELECT,
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    const active = await this.prisma.booking.count({
      where: { customerId: id, deletedAt: null, status: { in: ['HOLD', 'CONFIRMED', 'CHECKED_OUT'] } },
    });
    if (active > 0) throw new ConflictException('Customer has active bookings');
    return this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Driver Licenses ──────────────────────────────────────────────────────

  async addLicense(customerId: string, dto: DriverLicenseDto) {
    await this.findOne(customerId);
    return this.prisma.driverLicense.create({
      data: { customerId, ...dto, expiryDate: new Date(dto.expiryDate) },
    });
  }

  async deleteLicense(customerId: string, licenseId: string) {
    const lic = await this.prisma.driverLicense.findFirst({ where: { id: licenseId, customerId } });
    if (!lic) throw new NotFoundException('License not found');
    return this.prisma.driverLicense.delete({ where: { id: licenseId } });
  }

  // ── Additional Drivers ───────────────────────────────────────────────────

  async listAdditionalDrivers(bookingId: string) {
    return this.prisma.additionalDriver.findMany({
      where: { bookingId },
      include: { licenses: true },
    });
  }

  async addAdditionalDriver(bookingId: string, dto: AdditionalDriverDto) {
    const { license, ...driverData } = dto;
    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.additionalDriver.create({
        data: {
          ...driverData,
          bookingId,
          dateOfBirth: driverData.dateOfBirth ? new Date(driverData.dateOfBirth) : undefined,
        },
      });
      if (license) {
        await tx.driverLicense.create({
          data: { additionalDriverId: driver.id, ...license, expiryDate: new Date(license.expiryDate) },
        });
      }
      return tx.additionalDriver.findUnique({ where: { id: driver.id }, include: { licenses: true } });
    });
  }

  async removeAdditionalDriver(driverId: string) {
    const driver = await this.prisma.additionalDriver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Additional driver not found');
    return this.prisma.additionalDriver.delete({ where: { id: driverId } });
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async addTag(customerId: string, tagName: string) {
    await this.findOne(customerId);
    const tag = await this.prisma.tag.upsert({
      where: { name: tagName }, create: { name: tagName }, update: {},
    });
    await this.prisma.customerTag.upsert({
      where: { customerId_tagId: { customerId, tagId: tag.id } },
      create: { customerId, tagId: tag.id },
      update: {},
    });
    return tag;
  }

  async removeTag(customerId: string, tagId: string) {
    await this.prisma.customerTag.deleteMany({ where: { customerId, tagId } });
  }
}
