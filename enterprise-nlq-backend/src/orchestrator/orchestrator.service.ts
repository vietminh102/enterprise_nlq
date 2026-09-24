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
      const schemaContext = schemas.join('\n');
      console.log(`[Orchestrator] Đã tìm thấy Schema liên quan.`);

      // Bước 2: AI Text-to-SQL
      const aiResponse = await this.aiService.generateSql(question, schemaContext);
      
      // BÓC TÁCH JSON: Chuyển đổi phản hồi của AI thành Object và lấy ra chuỗi SQL
      let aiResultObj;
      try {
        // Làm sạch các thẻ markdown (nếu có) trước khi parse
        const cleanJsonString = typeof aiResponse === 'string' 
          ? aiResponse.replace(/```json/g, '').replace(/```/g, '').trim() 
          : aiResponse;
          
        aiResultObj = typeof cleanJsonString === 'string' ? JSON.parse(cleanJsonString) : cleanJsonString;
      } catch (e) {
        throw new Error('AI không trả về đúng định dạng JSON.');
      }

      // Trích xuất chuỗi SQL thuần túy
      const rawSql = aiResultObj.sql_query;
      console.log(`[Orchestrator] AI sinh ra SQL: ${rawSql}`);

      // Bước 3: Guardrails - Kiểm duyệt an toàn (Đầu vào giờ đây chắc chắn là String)
      const safeSql = this.guardrailsService.validateAndSanitize(rawSql);
      console.log(`[Orchestrator] SQL an toàn sau kiểm duyệt: ${safeSql}`);

      // Bước 4: Database - Chạy truy vấn
      const data = await this.dbService.executeQuery(safeSql);
      console.log(`[Orchestrator] Đã lấy được ${data.length} dòng dữ liệu.`);

      // Bước 5: Trả về kết quả tổng hợp
      return {
        success: true,
        question: question,
        generated_sql: safeSql,
        chart_type: aiResultObj.chart_type, // Trả thêm cấu hình biểu đồ cho Frontend
        explanation: aiResultObj.explanation, // Trả thêm lời giải thích của AI
        data: data
      };

    } catch (error: any) {
      console.error('[Orchestrator] Lỗi hệ thống:', error.message);
      throw new InternalServerErrorException(error.message);
    }
  }
}