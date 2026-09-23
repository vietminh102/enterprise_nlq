import { Controller, Get, Query } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { AiService } from './ai/ai.service';

@Controller()
export class AppController {
  // Tiêm DatabaseService vào để sử dụng
  constructor(private readonly dbService: DatabaseService,
  private readonly aiService: AiService,
  ) {}
  
  @Get('test-db')
  async testDatabase() {
    try {
      // Chạy thử một lệnh SQL siêu cơ bản
      const result = await this.dbService.executeQuery('SELECT NOW()');
      
      return {
        status: 'Thành công',
        message: 'Backend đã nói chuyện được với PostgreSQL!',
        data: result,
      };
    } catch (error: any) {
      return {
        status: 'Thất bại',
        message: error.message,
      };
    }
  }

  @Get('test-ai')
  async testAi(@Query('q') question: string) {
    if (!question) {
      return { message: 'Vui lòng truyền tham số ?q=cau_hoi_cua_ban' };
    }

    const schemaInfo = `
      Bảng 'employees': id, name, department, salary
      Bảng 'sales': id, employee_id, amount, sale_date
    `;

    try {
      const aiResult = await this.aiService.generateSql(question, schemaInfo);
      return {
        status: 'Thành công',
        user_question: question,
        ai_response: aiResult,
      };
    } catch (error: any) {
      return { status: 'Lỗi', message: error.message };
    }
  }
}
