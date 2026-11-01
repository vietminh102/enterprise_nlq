import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST') ?? this.config.get<string>('EMAIL_HOST');
    const user = this.config.get<string>('SMTP_USER') ?? this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('SMTP_PASS') ?? this.config.get<string>('EMAIL_PASS');
    if (!host || !user || !pass) {
      this.logger.warn('SMTP chưa cấu hình. Dùng SMTP_* hoặc EMAIL_* trong .env.');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? this.config.get<number>('EMAIL_PORT', 587),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: { user, pass },
    });
  }

  async sendQueryResult(input: {
    recipient: string;
    rows: Record<string, unknown>[];
    explanation?: string;
  }) {
    if (!this.transporter) throw new BadRequestException('SMTP chưa được cấu hình trong backend .env.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.recipient)) {
      throw new BadRequestException('Địa chỉ email nhận không hợp lệ.');
    }

    const info = await this.transporter.sendMail({
      from: this.getFromAddress(),
      to: input.recipient,
      subject: 'Kết quả phân tích Enterprise NLQ',
      html: this.buildHtml(input.explanation, input.rows),
      attachments: [{ filename: 'query-result.csv', content: this.toCsv(input.rows) }],
    });
    if (!info.messageId) throw new Error('SMTP không trả về messageId.');
    return { sent: true, messageId: info.messageId, recipient: input.recipient };
  }

  private getFromAddress() {
    const configured = this.config.get<string>('SMTP_FROM')?.trim();
    const fallback = this.config.get<string>('SMTP_USER') ?? this.config.get<string>('EMAIL_USER');
    if (configured?.includes('@')) return configured;
    if (fallback) return fallback;
    throw new BadRequestException('Thiếu SMTP_FROM hoặc EMAIL_USER.');
  }

  private buildHtml(explanation: string | undefined, rows: Record<string, unknown>[]) {
    const keys = Object.keys(rows[0] ?? {});
    const header = keys.map((key) => `<th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">${this.escape(key)}</th>`).join('');
    const body = rows.map((row) => `<tr>${keys.map((key) => `<td style="padding:8px;border:1px solid #ddd">${this.escape(String(row[key] ?? ''))}</td>`).join('')}</tr>`).join('');
    const table = keys.length ? `<table style="border-collapse:collapse;width:100%"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>` : '<p>Không có dữ liệu.</p>';
    return `<div style="font-family:Arial,sans-serif"><h3>Nhận định AI</h3><p>${this.escape(explanation ?? 'Đã hoàn tất truy vấn.')}</p><h3>Dữ liệu</h3>${table}</div>`;
  }

  private toCsv(rows: Record<string, unknown>[]) {
    const keys = Object.keys(rows[0] ?? {});
    return Buffer.from([keys.join(','), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n'), 'utf8');
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
  }
}
