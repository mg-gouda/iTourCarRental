import { Injectable, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';

interface LineItem {
  description: string;
  quantity: number;
  unitAmount: string;
  total: string;
  kind: string;
}

interface TaxLine {
  label: string;
  rate: number;
  amount: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as new (options?: Record<string, unknown>) => any;

const BRAND = '#1D4ED8'; // primary blue
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

@Injectable()
export class InvoicePdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateAndStream(invoiceId: string, res: Response) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: {
        booking: {
          include: {
            customer: { select: { fullName: true, email: true, phone: true } },
            pickupBranch: { select: { name: true, code: true, address: true, phone: true, email: true } },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    );
    doc.pipe(res);

    const lineItems = (invoice.lineItems as unknown as LineItem[]) ?? [];
    const taxLines = (invoice.taxLines as unknown as TaxLine[]) ?? [];
    const branch = invoice.booking?.pickupBranch;
    const customer = invoice.booking?.customer;

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .fillColor(BRAND)
      .font('Helvetica-Bold')
      .text('iTour Car Rental', 50, 50);

    doc
      .fontSize(9)
      .fillColor(MUTED)
      .font('Helvetica')
      .text(branch?.name ?? '', 50, 80)
      .text(branch?.address ?? '', 50, 92)
      .text(branch?.phone ?? '', 50, 104)
      .text(branch?.email ?? '', 50, 116);

    // Invoice title + number (right side)
    doc
      .fontSize(24)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('INVOICE', 350, 50, { align: 'right', width: 195 });

    doc
      .fontSize(10)
      .fillColor(MUTED)
      .font('Helvetica')
      .text(`# ${invoice.invoiceNumber}`, 350, 80, { align: 'right', width: 195 });

    const status = invoice.voidedAt ? 'VOIDED' : 'ISSUED';
    doc
      .fontSize(9)
      .fillColor(invoice.voidedAt ? '#DC2626' : '#059669')
      .font('Helvetica-Bold')
      .text(status, 350, 95, { align: 'right', width: 195 });

    // ── Divider ──────────────────────────────────────────────────────────────
    doc.moveTo(50, 135).lineTo(545, 135).strokeColor(BORDER).lineWidth(1).stroke();

    // ── Bill To + Dates ──────────────────────────────────────────────────────
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .font('Helvetica-Bold')
      .text('BILL TO', 50, 150)
      .fillColor('#111827')
      .font('Helvetica')
      .text(customer?.fullName ?? 'N/A', 50, 162)
      .fillColor(MUTED)
      .text(customer?.email ?? '', 50, 174)
      .text(customer?.phone ?? '', 50, 186);

    const issuedDate = new Date(invoice.issuedAt).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const dueDate = invoice.dueAt
      ? new Date(invoice.dueAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    doc
      .fontSize(9)
      .fillColor(MUTED)
      .font('Helvetica-Bold')
      .text('ISSUE DATE', 370, 150, { width: 175, align: 'right' })
      .fillColor('#111827')
      .font('Helvetica')
      .text(issuedDate, 370, 162, { width: 175, align: 'right' })
      .fillColor(MUTED)
      .font('Helvetica-Bold')
      .text('DUE DATE', 370, 178, { width: 175, align: 'right' })
      .fillColor('#111827')
      .font('Helvetica')
      .text(dueDate, 370, 190, { width: 175, align: 'right' });

    if (invoice.booking) {
      doc
        .fontSize(9)
        .fillColor(MUTED)
        .font('Helvetica-Bold')
        .text('BOOKING', 370, 206, { width: 175, align: 'right' })
        .fillColor('#111827')
        .font('Helvetica')
        .text(invoice.booking.bookingNumber, 370, 218, { width: 175, align: 'right' });
    }

    // ── Line items table ─────────────────────────────────────────────────────
    let y = 250;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 8;

    doc
      .fontSize(9)
      .fillColor(MUTED)
      .font('Helvetica-Bold')
      .text('DESCRIPTION', 50, y)
      .text('QTY', 360, y, { width: 40, align: 'right' })
      .text('UNIT PRICE', 405, y, { width: 70, align: 'right' })
      .text('TOTAL', 480, y, { width: 65, align: 'right' });

    y += 16;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 8;

    for (const item of lineItems) {
      if (y > 680) {
        doc.addPage();
        y = 50;
      }
      doc
        .fontSize(9)
        .fillColor('#111827')
        .font('Helvetica')
        .text(item.description, 50, y, { width: 300 })
        .text(String(item.quantity ?? 1), 360, y, { width: 40, align: 'right' })
        .text(
          `${invoice.currency} ${Number(item.unitAmount).toFixed(2)}`,
          405, y, { width: 70, align: 'right' },
        )
        .text(
          `${invoice.currency} ${Number(item.total).toFixed(2)}`,
          480, y, { width: 65, align: 'right' },
        );
      y += 20;
    }

    // ── Totals ───────────────────────────────────────────────────────────────
    y += 8;
    doc.moveTo(350, y).lineTo(545, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 12;

    const totalsX = 350;
    const amtX = 480;

    function addTotalRow(label: string, amount: string, bold = false, color = '#111827') {
      doc
        .fontSize(9)
        .fillColor(MUTED)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, totalsX, y, { width: 125 })
        .fillColor(color)
        .text(amount, amtX, y, { width: 65, align: 'right' });
      y += 16;
    }

    addTotalRow('Subtotal', `${invoice.currency} ${Number(invoice.subtotal).toFixed(2)}`);
    if (Number(invoice.discountTotal) > 0) {
      addTotalRow('Discount', `- ${invoice.currency} ${Number(invoice.discountTotal).toFixed(2)}`);
    }
    for (const tl of taxLines) {
      addTotalRow(`${tl.label} (${tl.rate}%)`, `${invoice.currency} ${Number(tl.amount).toFixed(2)}`);
    }
    doc.moveTo(totalsX, y).lineTo(545, y).strokeColor(BRAND).lineWidth(1).stroke();
    y += 8;
    addTotalRow('TOTAL', `${invoice.currency} ${Number(invoice.total).toFixed(2)}`, true, BRAND);

    // ── Footer ───────────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .font('Helvetica')
      .text(
        'Thank you for choosing iTour Car Rental.',
        50, 740, { align: 'center', width: 495 },
      );

    doc.end();
  }
}
