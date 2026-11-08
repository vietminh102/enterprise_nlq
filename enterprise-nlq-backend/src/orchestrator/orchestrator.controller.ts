import { Controller, Post, Get, Param, Body, BadRequestException, Delete } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { ChatopsService } from '../chatops/chatops.service';
import { ReportGeneratorService } from '../report-generator/report-generator.service';

@Controller('api/query') 
export class OrchestratorController {
  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly chatopsService: ChatopsService,
    private readonly reportGeneratorService: ReportGeneratorService
  ) {}
  
  @Post()
  async handleQuery(
    @Body('sessionId') sessionId: string,
    @Body('question') question: string,
    @Body('history') history?: any[],
    @Body('dbType') dbType?: string // BƯỚC 1: LẤY dbType TỪ FRONTEND
  ) {
    if (!question || !sessionId) {
      throw new BadRequestException('Vui lòng cung cấp tham số "question" và "sessionId" trong body JSON.');
    }
    
    // 1. PHÂN TÍCH Ý ĐỊNH GỬI EMAIL
    const recipient = question.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i)?.[0];
    const emailIntent = /\b(gửi|send)\b[\s\S]*\b(mail|email)\b|\b(mail|email)\b[\s\S]*\b(gửi|send)\b/i.test(question);
    
    // 2. LÀM SẠCH CÂU HỎI
    const analysisQuestion = recipient
      ? question.replace(recipient, '').replace(/\b(gửi|send|mail|email|cho|tới|đến|to)\b/gi, ' ').replace(/\s+/g, ' ').trim()
      : question;
      
    // 3. TRUY VẤN DỮ LIỆU (BƯỚC 2: TRUYỀN dbType XUỐNG SERVICE)
    const result = await this.orchestratorService.processNaturalLanguageQuery(sessionId, analysisQuestion, history, dbType);
    
    // Nếu không có ý định gửi email, trả kết quả về luôn cho UI
    if (!emailIntent) return result;
    
    // 4. KIỂM TRA ĐIỀU KIỆN TRƯỚC KHI GỬI (Giữ nguyên)
    if (!recipient) return { ...result, email_sent: false, email_error: 'Vui lòng cung cấp email nhận cụ thể.' };
    if (result.error || !result.data || result.data.length === 0) {
      return { ...result, email_sent: false, email_error: result.error ?? 'Không có dữ liệu để gửi.' };
    }

    // 5. TIẾN HÀNH TẠO EXCEL VÀ GỬI QUA CHATOPS (Giữ nguyên)
    try {
      const excelBuffer = await this.reportGeneratorService.generateMultiSheetExcelReport({ 
        'Dữ Liệu Truy Vấn': result.data 
      });
      
      const attachment = {
        filename: `Ket_Qua_Truy_Van_${new Date().getTime()}.xlsx`,
        buffer: excelBuffer
      };

      const emailContent = `Kính gửi,\n\nĐây là kết quả báo cáo cho yêu cầu: "${analysisQuestion}"\n\n🧠 **AI Phân Tích & Nhận Xét:**\n${result.explanation || 'Đã truy xuất xong dữ liệu.'}\n\nChi tiết dữ liệu vui lòng xem trong file Excel đính kèm.\n\nTrân trọng,\nHệ thống Enterprise NLQ Assistant.`;

      const success = await this.chatopsService.sendNotification('email', recipient, emailContent, attachment);
      
      if (success) {
         return { ...result, email_sent: true, email: { messageId: 'ChatOps-Delivered' } };
      } else {
         return { ...result, email_sent: false, email_error: 'Lỗi trong quá trình gửi mail qua SMTP.' };
      }
    } catch (error: any) {
      return { ...result, email_sent: false, email_error: error.message || 'Không thể gửi email.' };
    }
  }

  // --- Các API bên dưới giữ nguyên ---
  @Get('sessions')
  async getSessions() { return await this.orchestratorService.getAllChatSessions(); }

  @Get('history/:sessionId')
  async getHistory(@Param('sessionId') sessionId: string) { return await this.orchestratorService.getChatHistory(sessionId); }

  @Delete('history/:sessionId')
  async deleteHistory(@Param('sessionId') sessionId: string) { return await this.orchestratorService.deleteChatSession(sessionId); }
}