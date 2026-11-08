import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ChatopsService implements OnModuleInit {
  private readonly logger = new Logger(ChatopsService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = 'smtp-relay.brevo.com'; 
    const port = this.config.get<number>('SMTP_PORT') ?? 587;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    
    if (!user || !pass) {
      this.logger.warn('❌ Chưa cấu hình SMTP_USER và SMTP_PASS cho Brevo. Tính năng Email bị vô hiệu hóa.');
      return;
    }
    
    
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, 
      auth: { user, pass },
      connectionTimeout: 15000, 
      greetingTimeout: 10000,
    });

    this.logger.log(`✅ Đã khởi tạo dịch vụ gửi Email qua Brevo (Port: ${port}).`);
  }

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

  private async sendEmail(recipientEmail: string, content: string, attachment?: { filename: string, buffer: Buffer }) {
    if (!this.transporter) throw new BadRequestException('SMTP Brevo chưa được cấu hình.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      throw new BadRequestException('Địa chỉ email nhận không hợp lệ.');
    }

    const mailOptions: any = {
      from: this.getFromAddress(),
      to: recipientEmail,
      subject: '📊 Báo Cáo Phân Tích Dữ Liệu Enterprise',
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${content.replace(/\n/g, '<br/>')}</div>`,
    };

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

  private getFromAddress() {
    const configured = this.config.get<string>('SMTP_FROM')?.trim();
    if (configured) return configured;
    
    const defaultUser = this.config.get<string>('SMTP_USER');
    return `"Enterprise AI Assistant" <${defaultUser}>`;
  }
}