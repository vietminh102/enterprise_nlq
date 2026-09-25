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

      // XỬ LÝ AN TOÀN: Nếu schemas là mảng Object, ta cần trích xuất đúng cột chứa nội dung lược đồ (VD: description, schema_info, v.v.)
      const schemaContext = schemas.map((item: any) => {
        if (typeof item === 'string') return item;
        // Sửa 'description' thành tên cột lưu Schema thực tế trong bảng enterprise_embeddings của bạn
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
      const data = await this.dbService.executeQuery(safeSql);
      console.log(`[Orchestrator] Đã lấy được ${data.length} dòng dữ liệu.`);

      // Bước 5: Trả về kết quả
      return {
        success: true,
        question: question,
        generated_sql: safeSql,
        chart_type: aiResultObj.chart_type,
        explanation: aiResultObj.explanation,
        data: data
      };

    } catch (error: any) {
      console.error('[Orchestrator] Lỗi hệ thống:', error.message);
      throw new InternalServerErrorException(error.message);
    }
  }
}