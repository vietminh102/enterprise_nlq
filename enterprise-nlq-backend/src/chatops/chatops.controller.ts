import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ChatopsService } from './chatops.service';

@Controller('chatops')
export class ChatopsController {
  constructor(private readonly chatopsService: ChatopsService) {}

  @Post('test-email')
  async sendTest(@Body('recipient') recipient: string) {
    if (!recipient) throw new BadRequestException('Vui lòng cung cấp recipient.');
    
    // Sử dụng hàm sendNotification chuẩn hóa
    const success = await this.chatopsService.sendNotification(
      'email', 
      recipient, 
      'Hệ thống ChatOps đã được gộp chung và hoạt động ổn định!'
    );

    return { sent: success, recipient };
  }
}