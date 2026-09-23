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

      // Bước 2: AI Text-to-SQL (Bạn tự điều chỉnh tên hàm generateSql cho khớp với AiService của bạn)
      // Giả sử hàm này nhận vào câu hỏi và ngữ cảnh schema
      const generatedSql = await this.aiService.generateSql(question, schemaContext);
      console.log(`[Orchestrator] AI sinh ra SQL: ${generatedSql}`);

      // Bước 3: Guardrails - Kiểm duyệt an toàn
      // Giả sử hàm này kiểm tra câu lệnh SELECT và tự động thêm LIMIT 100
      const safeSql = this.guardrailsService.validateAndSanitize(generatedSql);
      console.log(`[Orchestrator] SQL an toàn sau kiểm duyệt: ${safeSql}`);

      // Bước 4: Database - Chạy truy vấn
      const data = await this.dbService.executeQuery(safeSql);
      console.log(`[Orchestrator] Đã lấy được ${data.length} dòng dữ liệu.`);

      // Bước 5: Trả về kết quả tổng hợp
      return {
        success: true,
        question: question,
        generated_sql: safeSql,
        data: data
      };

    } catch (error: any) {
      console.error('[Orchestrator] Lỗi hệ thống:', error.message);
      throw new InternalServerErrorException(error.message);
    }
  }
}