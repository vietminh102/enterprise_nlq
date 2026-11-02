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
    @Body('history') history?: any[]
  ) {
    if (!question || !sessionId) {
      throw new BadRequestException('Vui lòng cung cấp tham số "question" và "sessionId" trong body JSON.');
    }
    
    // 1. PHÂN TÍCH Ý ĐỊNH GỬI EMAIL (Regex cũ của bạn)
    const recipient = question.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i)?.[0];
    const emailIntent = /\b(gửi|send)\b[\s\S]*\b(mail|email)\b|\b(mail|email)\b[\s\S]*\b(gửi|send)\b/i.test(question);
    
    // 2. LÀM SẠCH CÂU HỎI ĐỂ AI KHÔNG BỊ NHIỄU
    const analysisQuestion = recipient
      ? question.replace(recipient, '').replace(/\b(gửi|send|mail|email|cho|tới|đến|to)\b/gi, ' ').replace(/\s+/g, ' ').trim()
      : question;
      
    // 3. TRUY VẤN DỮ LIỆU BÌNH THƯỜNG
    const result = await this.orchestratorService.processNaturalLanguageQuery(sessionId, analysisQuestion, history);
    
    // Nếu không có ý định gửi email, trả kết quả về luôn cho UI
    if (!emailIntent) return result;
    
    // 4. KIỂM TRA ĐIỀU KIỆN TRƯỚC KHI GỬI
    if (!recipient) return { ...result, email_sent: false, email_error: 'Vui lòng cung cấp email nhận cụ thể.' };
    if (result.error || !result.data || result.data.length === 0) {
      return { ...result, email_sent: false, email_error: result.error ?? 'Không có dữ liệu để gửi.' };
    }

    // 5. TIẾN HÀNH TẠO EXCEL VÀ GỬI QUA CHATOPS
    try {
      // Dùng service để tạo file Excel đẹp (Tái sử dụng code)
      const excelBuffer = await this.reportGeneratorService.generateMultiSheetExcelReport({ 
        'Dữ Liệu Truy Vấn': result.data 
      });
      
      const attachment = {
        filename: `Ket_Qua_Truy_Van_${new Date().getTime()}.xlsx`,
        buffer: excelBuffer
      };

      // Định dạng nội dung email (lấy luôn giải thích của AI)
      const emailContent = `Kính gửi,

Đây là kết quả báo cáo cho yêu cầu: "${analysisQuestion}"

🧠 **AI Phân Tích & Nhận Xét:**
${result.explanation || 'Đã truy xuất xong dữ liệu.'}

Chi tiết dữ liệu vui lòng xem trong file Excel đính kèm.

Trân trọng,
Hệ thống Enterprise NLQ Assistant.`;

      // Gọi ChatOps phát mail đi
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