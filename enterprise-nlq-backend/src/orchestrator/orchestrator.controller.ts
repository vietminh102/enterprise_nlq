import { Controller, Post, Get, Param, Body, BadRequestException,Delete } from '@nestjs/common'; // <-- Đã thêm Get và Param ở đây
import { OrchestratorService } from './orchestrator.service';
import { EmailService } from '../email-service/email.service';

@Controller('api/query') 
export class OrchestratorController {
  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly emailService: EmailService,
  ) {}
  
  @Post()
  async handleQuery(
    @Body('sessionId') sessionId: string,
    @Body('question') question: string,
    @Body('history') history?: any[]
  ) {
    if (!question || !sessionId) {
      throw new BadRequestException('Vui lòng cung cấp tham số "question" và "sessionId" trong body JSON.');
    }
    
    const recipient = question.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const emailIntent = /\b(gửi|send)\b[\s\S]*\b(mail|email)\b|\b(mail|email)\b[\s\S]*\b(gửi|send)\b/i.test(question);
    const analysisQuestion = recipient
      ? question.replace(recipient, '').replace(/\b(gửi|send|mail|email|cho|tới|đến|to)\b/gi, ' ').replace(/\s+/g, ' ').trim()
      : question;
    const result = await this.orchestratorService.processNaturalLanguageQuery(sessionId, analysisQuestion, history);
    if (!emailIntent) return result;
    if (!recipient) return { ...result, email_sent: false, email_error: 'Vui lòng cung cấp email nhận.' };
    if (result.error || !result.data) return { ...result, email_sent: false, email_error: result.error ?? 'Không có dữ liệu để gửi.' };

    try {
      const email = await this.emailService.sendQueryResult({
        recipient,
        rows: result.data,
        explanation: result.explanation,
      });
      return { ...result, email_sent: true, email };
    } catch (error) {
      return { ...result, email_sent: false, email_error: error instanceof Error ? error.message : 'Không thể gửi email.' };
    }
  }

  // 1. API lấy danh sách các đoạn chat cho Sidebar
  @Get('sessions')
  async getSessions() {
    return await this.orchestratorService.getAllChatSessions();
  }

  // 2. API lấy chi tiết lịch sử tin nhắn khi click vào 1 đoạn chat trên Sidebar
  @Get('history/:sessionId')
  async getHistory(@Param('sessionId') sessionId: string) {
    return await this.orchestratorService.getChatHistory(sessionId);
  }
  @Delete('history/:sessionId')
  async deleteHistory(@Param('sessionId') sessionId: string) {
    return await this.orchestratorService.deleteChatSession(sessionId);
  }
}