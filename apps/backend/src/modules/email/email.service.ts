import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getTransporter() {
    const settings = await this.prisma.setting.findMany({
      where: { key: { startsWith: 'smtp.' } },
    });
    const cfg = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));

    const host = cfg['smtp.host'] as string | undefined;
    if (!host) {
      this.logger.warn('SMTP not configured — email skipped');
      return null;
    }

    return nodemailer.createTransport({
      host,
      port: Number(cfg['smtp.port'] ?? 587),
      secure: cfg['smtp.secure'] === true || cfg['smtp.secure'] === 'true',
      auth: {
        user: cfg['smtp.user'] as string | undefined,
        pass: cfg['smtp.pass'] as string | undefined,
      },
    });
  }

  private async getFrom() {
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: ['smtp.from', 'smtp.fromName'] } },
    });
    const cfg = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
    const name = (cfg['smtp.fromName'] as string) || 'iTour Car Rental';
    const address = (cfg['smtp.from'] as string) || 'noreply@example.com';
    return `"${name}" <${address}>`;
  }

  async send(opts: SendMailOptions): Promise<boolean> {
    try {
      const transport = await this.getTransporter();
      if (!transport) return false;
      const from = await this.getFrom();
      await transport.sendMail({ from, ...opts });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${(err as Error).message}`);
      return false;
    }
  }

  async sendBookingConfirmation(booking: {
    bookingNumber: string;
    customer: { fullName: string; email: string | null };
    pickupAt: string;
    returnAt: string;
    car: { make: string; model: string; licensePlate: string };
    pickupBranch: { name: string };
    returnBranch: { name: string };
    totalAmount: string | number;
    currency: string;
  }) {
    if (!booking.customer.email) return;
    await this.send({
      to: booking.customer.email,
      subject: `Booking Confirmed — ${booking.bookingNumber}`,
      html: `
        <h2>Booking Confirmed</h2>
        <p>Dear ${booking.customer.fullName},</p>
        <p>Your booking <strong>${booking.bookingNumber}</strong> has been confirmed.</p>
        <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:480px">
          <tr><td><b>Vehicle</b></td><td>${booking.car.make} ${booking.car.model} (${booking.car.licensePlate})</td></tr>
          <tr><td><b>Pickup</b></td><td>${new Date(booking.pickupAt).toLocaleString()} — ${booking.pickupBranch.name}</td></tr>
          <tr><td><b>Return</b></td><td>${new Date(booking.returnAt).toLocaleString()} — ${booking.returnBranch.name}</td></tr>
          <tr><td><b>Total</b></td><td>${booking.currency} ${Number(booking.totalAmount).toFixed(2)}</td></tr>
        </table>
        <p>Thank you for choosing iTour Car Rental.</p>
      `,
    });
  }

  async sendInvoiceNotification(opts: {
    to: string;
    customerName: string;
    invoiceNumber: string;
    total: number;
    currency: string;
  }) {
    await this.send({
      to: opts.to,
      subject: `Invoice ${opts.invoiceNumber} — ${opts.currency} ${opts.total.toFixed(2)}`,
      html: `
        <h2>Invoice Ready</h2>
        <p>Dear ${opts.customerName},</p>
        <p>Invoice <strong>${opts.invoiceNumber}</strong> for ${opts.currency} ${opts.total.toFixed(2)} has been generated.</p>
        <p>Please contact us if you have any questions.</p>
        <p>Thank you for choosing iTour Car Rental.</p>
      `,
    });
  }

  async sendRefundNotification(opts: {
    to: string;
    customerName: string;
    bookingNumber: string;
    amount: number;
    currency: string;
  }) {
    await this.send({
      to: opts.to,
      subject: `Refund Processed — ${opts.bookingNumber}`,
      html: `
        <h2>Refund Processed</h2>
        <p>Dear ${opts.customerName},</p>
        <p>A refund of <strong>${opts.currency} ${opts.amount.toFixed(2)}</strong> has been processed for booking ${opts.bookingNumber}.</p>
        <p>Please allow 3–5 business days for the funds to appear in your account.</p>
        <p>Thank you for choosing iTour Car Rental.</p>
      `,
    });
  }
}
