import { Decimal, InputJsonValue } from '@prisma/client/runtime/library';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GenerateInvoiceDto,
  VoidInvoiceDto,
  CreateCreditNoteDto,
} from './dto/invoice.dto';

const INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  branchId: true,
  bookingId: true,
  kind: true,
  issuedAt: true,
  dueAt: true,
  currency: true,
  subtotal: true,
  discountTotal: true,
  taxTotal: true,
  total: true,
  lineItems: true,
  taxLines: true,
  pdfKey: true,
  language: true,
  voidedAt: true,
  voidedReason: true,
  deletedAt: true,
  booking: { select: { id: true, bookingNumber: true, status: true, pickupBranch: { select: { id: true, code: true, name: true } } } },
  creditNotes: {
    select: {
      id: true,
      creditNoteNumber: true,
      invoiceId: true,
      amount: true,
      currency: true,
      reason: true,
      lineItems: true,
      pdfKey: true,
      issuedAt: true,
      language: true,
    },
  },
};

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page?: number;
    limit?: number;
    bookingId?: string;
    branchId?: string;
    kind?: string;
    from?: string;
    to?: string;
  }) {
    const { page = 1, limit = 20, bookingId, branchId, kind, from, to } = query;
    const where: any = {
      deletedAt: null,
      ...(bookingId && { bookingId }),
      ...(branchId && { branchId }),
      ...(kind && { kind }),
      ...(from || to
        ? {
            issuedAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        select: INVOICE_SELECT,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async get(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      select: INVOICE_SELECT,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async generate(dto: GenerateInvoiceDto) {
    const kind = dto.kind ?? 'rental';
    const language = dto.language ?? 'en';

    // Validate booking exists and is in an acceptable state
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
      include: { pickupBranch: { select: { id: true, code: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const allowedStatuses = kind === 'rental' ? ['COMPLETED', 'ACTIVE'] : ['ACTIVE', 'COMPLETED'];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot generate ${kind} invoice for booking in status ${booking.status}`,
      );
    }

    // Idempotency: return existing rental invoice if already generated for this booking+kind
    if (kind === 'rental') {
      const existing = await this.prisma.invoice.findFirst({
        where: { bookingId: dto.bookingId, kind: 'rental', deletedAt: null },
        select: INVOICE_SELECT,
      });
      if (existing) return existing;
    }

    // Build line items and totals from price snapshot
    const snapshot = booking.priceSnapshot as Record<string, unknown> | null;
    const lineItems: Record<string, unknown>[] = [];
    const taxLines: Record<string, unknown>[] = [];

    let subtotal = new Decimal(0);
    let discountTotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    let total = new Decimal(0);

    if (snapshot) {
      // Map priceSnapshot structure → line items
      if (Array.isArray(snapshot.lines)) {
        for (const line of snapshot.lines as Record<string, unknown>[]) {
          lineItems.push({
            description: line.description ?? '',
            quantity: line.quantity ?? 1,
            unitAmount: line.unitAmount ?? '0',
            total: line.total ?? '0',
            kind: line.kind ?? 'base',
          });
          const lineTotal = new Decimal(String(line.total ?? 0));
          subtotal = subtotal.plus(lineTotal);
        }
      }
      if (Array.isArray(snapshot.taxLines)) {
        for (const tl of snapshot.taxLines as Record<string, unknown>[]) {
          taxLines.push(tl);
          taxTotal = taxTotal.plus(new Decimal(String(tl.amount ?? 0)));
        }
      }
      if (snapshot.discount) {
        discountTotal = new Decimal(String(snapshot.discount));
      }
      if (snapshot.total) {
        total = new Decimal(String(snapshot.total));
      } else {
        total = subtotal.minus(discountTotal).plus(taxTotal);
      }
    }

    // Generate invoice number: {BRANCH_CODE}-{YEAR}-{padded 4-digit sequence}
    const branchCode = booking.pickupBranch.code;
    const year = new Date().getFullYear();
    const sequenceCount = await this.prisma.invoice.count({
      where: { branchId: booking.pickupBranchId, issuedAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    });
    const sequence = String(sequenceCount + 1).padStart(4, '0');
    const invoiceNumber = `${branchCode}-${year}-${sequence}`;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        branchId: booking.pickupBranchId,
        bookingId: dto.bookingId,
        kind,
        language,
        currency: booking.currency,
        subtotal,
        discountTotal,
        taxTotal,
        total,
        lineItems: lineItems as InputJsonValue,
        taxLines: taxLines as InputJsonValue,
      },
      select: INVOICE_SELECT,
    });
  }

  async void(id: string, dto: VoidInvoiceDto) {
    const invoice = await this.get(id);
    if (invoice.voidedAt) throw new ConflictException('Invoice is already voided');

    return this.prisma.invoice.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidedReason: dto.reason,
      },
      select: INVOICE_SELECT,
    });
  }

  async issueCreditNote(invoiceId: string, dto: CreateCreditNoteDto) {
    const invoice = await this.get(invoiceId);
    if (invoice.voidedAt) throw new ConflictException('Cannot issue credit note on a voided invoice');

    const creditNoteNumber = `CN-${invoice.invoiceNumber}`;

    // Allow multiple credit notes by appending a suffix if CN already exists
    const existingCount = await this.prisma.creditNote.count({
      where: { invoiceId },
    });
    const finalNumber = existingCount === 0 ? creditNoteNumber : `${creditNoteNumber}-${existingCount + 1}`;

    return this.prisma.creditNote.create({
      data: {
        creditNoteNumber: finalNumber,
        invoiceId,
        amount: new Decimal(dto.amount),
        currency: invoice.currency as string,
        reason: dto.reason,
        lineItems: (dto.lineItems ?? []) as InputJsonValue,
        language: dto.language ?? 'en',
      },
    });
  }
}
