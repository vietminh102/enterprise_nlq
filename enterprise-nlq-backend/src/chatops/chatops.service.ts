import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatopsService implements OnModuleInit {
  private readonly logger = new Logger(ChatopsService.name);
  private apiKey: string;
  private senderEmail: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
  this.apiKey = this.config.get<string>('BREVO_API_KEY')!; 
  this.senderEmail = this.config.get<string>('SMTP_FROM') || 'thongbaolovee@gmail.com';
    
    if (!this.apiKey) {
      this.logger.warn('❌ Chưa cấu hình BREVO_API_KEY. Tính năng Email API bị vô hiệu hóa.');
    } else {
      this.logger.log('✅ Đã khởi tạo dịch vụ gửi Email qua API Brevo (Port 443).');
    }
  }

  async sendNotification(
    channel: 'email' | 'zalo' | 'slack', 
    recipient: string, 
    content: string, 
    attachment?: { filename: string, buffer: Buffer }
  ) {
    try {
      this.logger.log(`Đang gọi API gửi thông báo qua ${channel} tới ${recipient}...`);

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
    if (!this.apiKey) throw new BadRequestException('BREVO_API_KEY chưa được cấu hình.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      throw new BadRequestException('Địa chỉ email nhận không hợp lệ.');
    }

    const url = 'https://api.brevo.com/v3/smtp/email';
    const headers = {
      'accept': 'application/json',
      'api-key': this.apiKey,
      'content-type': 'application/json',
    };

    // Đóng gói JSON Payload chuẩn của Brevo API
    const payload: any = {
      sender: { name: 'Enterprise AI Assistant', email: this.senderEmail },
      to: [{ email: recipientEmail }],
      subject: '📊 Báo Cáo Phân Tích Dữ Liệu Enterprise',
      htmlContent: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${content.replace(/\n/g, '<br/>')}</div>`
    };

    // Xử lý file đính kèm: Chuyển Buffer thành Base64
    if (attachment) {
      payload.attachment = [
        {
          name: attachment.filename,
          content: attachment.buffer.toString('base64') 
        }
      ];
    }

    // Gọi HTTP Request bằng fetch
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API Error: ${JSON.stringify(errorData)}`);
    }

    const info = await response.json();
    this.logger.log(`✅ Email API đã gửi thành công (Message ID: ${info.messageId})`);
    return info;
  }
}