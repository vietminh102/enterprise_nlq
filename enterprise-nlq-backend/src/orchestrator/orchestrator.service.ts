import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service'; 
import { GuardrailsService } from '../guardrails/guardrails.service';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly vectorSearchService: VectorSearchService,
    private readonly aiService: AiService,
    private readonly guardrailsService: GuardrailsService,
    private readonly dbService: DatabaseService,
  ) {}

  async processNaturalLanguageQuery(question: string) {
    try {
      console.log(`[Orchestrator] Nhận câu hỏi: "${question}"`);

      // Bước 1: RAG - Tìm Schema liên quan
      const schemas = await this.vectorSearchService.findRelevantSchemas(question);
      
      // LOG ĐỂ KIỂM TRA DỮ LIỆU THÔ TỪ VECTOR SEARCH
      console.log(`[Orchestrator] Dữ liệu thô từ Vector Search:`, schemas);

      if (!schemas || schemas.length === 0) {
        console.warn(`[Orchestrator] ⚠️ CẢNH BÁO: Không tìm thấy Schema nào trong Vector DB.`);
      }

      
      const schemaContext = schemas.map((item: any) => {
        if (typeof item === 'string') return item;
        return item.description || item.schema_info || item.content || JSON.stringify(item); 
      }).join('\n');

      console.log(`[Orchestrator] Đã tổng hợp Schema dài ${schemaContext.length} ký tự.`);

      // Bước 2: AI Text-to-SQL
      const aiResponse = await this.aiService.generateSql(question, schemaContext);
      
      // BÓC TÁCH JSON
      let aiResultObj;
      try {
        const cleanJsonString = typeof aiResponse === 'string' 
          ? aiResponse.replace(/```json/g, '').replace(/```/g, '').trim() 
          : aiResponse;
          
        aiResultObj = typeof cleanJsonString === 'string' ? JSON.parse(cleanJsonString) : cleanJsonString;
      } catch (e) {
        throw new Error('AI không trả về đúng định dạng JSON.');
      }

      const rawSql = aiResultObj.sql_query;
      console.log(`[Orchestrator] AI sinh ra SQL: ${rawSql}`);

      // Bước 3: Guardrails
      const safeSql = this.guardrailsService.validateAndSanitize(rawSql);
      console.log(`[Orchestrator] SQL an toàn: ${safeSql}`);

      // Bước 4: Database
      const dbData = await this.dbService.executeBizQuery(safeSql);
      console.log(`[Orchestrator] Đã lấy được ${dbData.length} dòng dữ liệu.`);

      let insights = "";
      if (dbData && dbData.length > 0) {
        console.log(`[Orchestrator] Đang nhờ AI phân tích số liệu thực tế...`);
        insights = await this.aiService.generateDataInsights(question, dbData);
      }
      return {
        success: true,
        question: question,
        generated_sql: safeSql,
        chart_type: aiResultObj.chart_type,
        explanation: insights,
        data: dbData
      };

    } catch (error: any) {
      console.error('[Orchestrator] Lỗi hệ thống:', error.message);
      
      const errorMsg = error.message?.toLowerCase() || '';

      // 1. Nhận diện lỗi Thêm/Sửa/Xóa từ Guardrails HOẶC vi phạm an toàn từ AI
      if (
        errorMsg.includes('safety_violation') || 
        errorMsg.includes('vi phạm bảo mật') || 
        errorMsg.includes('chỉ cho phép lệnh select')
      ) {
        return { 
          error: "Yêu cầu bị chặn do vi phạm quy định bảo vệ dữ liệu (Phát hiện thao tác Thêm/Sửa/Xóa).", 
          error_type: "SAFETY_VIOLATION" 
        };
      }
      
      // 2. Nhận diện lỗi đã đổi hết các Model nhưng vẫn quá tải
      if (errorMsg.includes('all_models_overloaded')) {
        return { 
          error: "Hệ thống AI hiện đang quá tải. Đã thử tự động chuyển đổi qua lại giữa các phiên bản nhưng không thành công. Vui lòng thử lại sau vài phút.", 
          error_type: "LIMIT_REACHED" 
        };
      }

      // 3. Xử lý các lỗi khác
      return { 
        error: error.message || "Lỗi hệ thống không xác định.", 
        error_type: "UNKNOWN" 
      };
    }
  }
}