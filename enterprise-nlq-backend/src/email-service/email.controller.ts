import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email-service')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  sendTest(@Body('recipient') recipient: string) {
    if (!recipient) throw new BadRequestException('Vui lòng cung cấp recipient.');
    return this.emailService.sendQueryResult({
      recipient,
      rows: [{ status: 'ok', sent_at: new Date().toISOString() }],
      explanation: 'Email Service đang hoạt động.',
    });
  }
}
