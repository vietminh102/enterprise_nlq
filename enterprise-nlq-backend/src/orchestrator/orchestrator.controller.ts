import { Controller, Post, Get, Param, Body, BadRequestException } from '@nestjs/common'; // <-- Đã thêm Get và Param ở đây
import { OrchestratorService } from './orchestrator.service';

@Controller('api/query') 
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}
  
  @Post()
  async handleQuery(
    @Body('sessionId') sessionId: string,
    @Body('question') question: string,
    @Body('history') history?: any[]
  ) {
    if (!question || !sessionId) {
      throw new BadRequestException('Vui lòng cung cấp tham số "question" và "sessionId" trong body JSON.');
    }
    
    return await this.orchestratorService.processNaturalLanguageQuery(sessionId, question, history);
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
}