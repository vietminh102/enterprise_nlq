
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ChatopsService {
  private readonly logger = new Logger(ChatopsService.name);

  // 1. Thêm tham số attachment (Tùy chọn)
  async sendNotification(
    channel: 'email' | 'zalo' | 'slack', 
    recipient: string, 
    content: string, 
    attachment?: { filename: string, buffer: Buffer }
  ) {
    try {
      this.logger.log(`Đang gửi báo cáo qua ${channel} tới ${recipient}...`);

      switch (channel) {
        case 'email':
          await this.sendEmail(recipient, content, attachment); // Truyền attachment xuống
          break;
        case 'zalo':
          await this.sendZalo(recipient, content);
          break;
        case 'slack':
          await this.sendSlack(recipient, content);
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

  // 2. Xử lý đính kèm file trong hàm sendEmail
  private async sendEmail(recipientEmail: string, content: string, attachment?: { filename: string, buffer: Buffer }) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'thongbaolovee@gmail.com', // Thay bằng email của bạn
          pass: 'yhnyevchykkreyae',     // NHỚ ĐIỀN LẠI 16 KÝ TỰ MẬT KHẨU ỨNG DỤNG CỦA BẠN VÀO ĐÂY
        },
      });

      const mailOptions: any = {
        from: '"Enterprise AI Assistant" <thongbaolovee@gmail.com>',
        to: recipientEmail,
        subject: '📊 [Tự Động] Báo Cáo Phân Tích Dữ Liệu',
        text: content, 
      };

      // NẾU CÓ FILE ĐÍNH KÈM THÌ THÊM VÀO EMAIL
      if (attachment) {
        mailOptions.attachments = [
          {
            filename: attachment.filename,
            content: attachment.buffer
          }
        ];
      }

      const info = await transporter.sendMail(mailOptions);
      this.logger.log(`✅ Email đã được gửi tới ${recipientEmail} (ID: ${info.messageId})`);
      
    } catch (error: any) {
      this.logger.error(`❌ Lỗi thực tế khi gửi Email: ${error.message}`);
      throw error; 
    }
  }

  private async sendZalo(phoneOrId: string, content: string) {}
  private async sendSlack(webhookUrl: string, content: string) {}
}