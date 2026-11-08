import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ChatopsService implements OnModuleInit {
  private readonly logger = new Logger(ChatopsService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST') ?? 'smtp-relay.brevo.com'; 
    const user = this.config.get<string>('SMTP_USER') ?? this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('SMTP_PASS') ?? this.config.get<string>('EMAIL_PASS');
    
    if (!host || !user || !pass) {
      this.logger.warn('SMTP (Brevo/Gmail) chưa cấu hình đầy đủ trong file .env. Tính năng Email có thể bị lỗi.');
      return;
    }
    
    // CẤU HÌNH NODEMAILER TỐI ƯU CHO BREVO 
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: false, 
      auth: { user, pass },
      connectionTimeout: 10000, 
      greetingTimeout: 5000,
    });

    this.logger.log('Đã khởi tạo dịch vụ gửi Email (SMTP).');
  }

  // HÀM ĐIỀU PHỐI ĐA KÊNH
  async sendNotification(
    channel: 'email' | 'zalo' | 'slack', 
    recipient: string, 
    content: string, 
    attachment?: { filename: string, buffer: Buffer }
  ) {
    try {
      this.logger.log(`Đang gửi thông báo qua ${channel} tới ${recipient}...`);

      switch (channel) {
        case 'email':
          await this.sendEmail(recipient, content, attachment);
          break;
        case 'zalo':
          // await this.sendZalo(recipient, content);
          break;
        case 'slack':
          // await this.sendSlack(recipient, content);
          break;
        default:
          throw new Error('Kênh thông báo không được hỗ trợ.');
      }
      
      this.logger.log(`✅ Gửi thành công tới ${recipient} qua ${channel}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Lỗi gửi thông báo: ${error.message}`);
      return false;
    }
  }

  // HÀM GỬI EMAIL CHUYÊN SÂU
  private async sendEmail(recipientEmail: string, content: string, attachment?: { filename: string, buffer: Buffer }) {
    if (!this.transporter) throw new BadRequestException('SMTP chưa được cấu hình trong backend .env.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      throw new BadRequestException('Địa chỉ email nhận không hợp lệ.');
    }

    const mailOptions: any = {
      from: this.getFromAddress(),
      to: recipientEmail,
      subject: '📊 Báo Cáo Phân Tích Dữ Liệu Enterprise',
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${content.replace(/\n/g, '<br/>')}</div>`,
    };

    // Chèn file Excel (hoặc CSV) đính kèm nếu có
    if (attachment) {
      mailOptions.attachments = [
        {
          filename: attachment.filename,
          content: attachment.buffer
        }
      ];
    }

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(`✅ Email đã gửi thành công (ID: ${info.messageId})`);
    return info;
  }

  // LẤY ĐỊA CHỈ NGƯỜI GỬI
  private getFromAddress() {
    const configured = this.config.get<string>('SMTP_FROM')?.trim();
    if (configured) return configured;
    
    return '"Enterprise AI Assistant" <no-reply@enterprise.com>';
  }
}