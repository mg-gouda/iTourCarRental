import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Models that have a deletedAt field — soft delete filtering applies
const SOFT_DELETE_MODELS = new Set([
  'user',
  'branch',
  'car',
  'customer',
  'corporateAccount',
  'insurancePolicy',
  'maintenanceRecord',
  'maintenanceVendor',
  'accidentReport',
  'invoice',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    // Soft delete middleware: automatically filter out deletedAt IS NOT NULL
    // for all read operations on models that support it
    (this as PrismaClient).$use(async (params, next) => {
      if (!params.model) return next(params);

      const modelKey = params.model.charAt(0).toLowerCase() + params.model.slice(1);

      if (!SOFT_DELETE_MODELS.has(modelKey)) {
        return next(params);
      }

      if (params.action === 'findMany' || params.action === 'findFirst') {
        if (params.args == null) {
          params.args = {};
        }
        if (params.args.where == null) {
          params.args.where = {};
        }
        // Only apply if caller hasn't explicitly set deletedAt
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
        // Convert to findFirst so we can add deletedAt filter
        params.action = params.action === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst';
        if (params.args == null) {
          params.args = {};
        }
        if (params.args.where == null) {
          params.args.where = {};
        }
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      if (params.action === 'count') {
        if (params.args == null) {
          params.args = {};
        }
        if (params.args.where == null) {
          params.args.where = {};
        }
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
