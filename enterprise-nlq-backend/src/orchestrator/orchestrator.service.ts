import { Injectable, Logger } from '@nestjs/common';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service'; 
import { GuardrailsService } from '../guardrails/guardrails.service';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly vectorSearchService: VectorSearchService,
    private readonly aiService: AiService,
    private readonly guardrailsService: GuardrailsService,
    private readonly dbService: DatabaseService,
  ) {}

  // Luồng Pipeline chính điều phối các luồng con
  async processNaturalLanguageQuery(question: string, signal?: AbortSignal) {
    try {
      this.logger.log(`Bắt đầu pipeline cho câu hỏi: "${question}"`);

      // Bước 1: RAG - Tìm Schema liên quan
      const schemaContext = await this.step1_lookupSchema(question, signal);

      // Bước 2: AI Text-to-SQL & Kiểm duyệt an toàn
      const aiResult = await this.step2_generateAndValidateSql(question, schemaContext, signal);

      // Bước 3: Truy vấn cơ sở dữ liệu
      const dbData = await this.step3_queryDatabase(aiResult.safeSql, signal);

      // Bước 4: AI Insight Generation (Có giới hạn thời gian độc lập)
      const insights = await this.step4_generateInsightsAsync(question, dbData, signal);

      return {
        success: true,
        question: question,
        generated_sql: aiResult.safeSql,
        chart_type: aiResult.chartType,
        explanation: insights,
        data: dbData
      };

    } catch (error: any) {
      return this.handlePipelineError(error);
    }
  }

  /* --- CÁC HÀM XỬ LÝ ĐỘC LẬP TỪNG BƯỚC CỦA PIPELINE --- */

  private async step1_lookupSchema(question: string, signal?: AbortSignal): Promise<string> {
    const schemas = await this.vectorSearchService.findRelevantSchemas(question);
    
    this.logger.debug(`Dữ liệu thô từ Vector Search:`, schemas);

    if (!schemas || schemas.length === 0) {
      this.logger.warn(`⚠️ CẢNH BÁO: Không tìm thấy Schema nào trong Vector DB.`);
      return '';
    }

    const schemaContext = schemas.map((item: any) => {
      if (typeof item === 'string') return item;
      return item.description || item.schema_info || item.content || JSON.stringify(item); 
    }).join('\n');

    this.logger.log(`Đã tổng hợp Schema dài ${schemaContext.length} ký tự.`);
    return schemaContext;
  }

  private async step2_generateAndValidateSql(
    question: string, 
    schemaContext: string, 
    signal?: AbortSignal
  ): Promise<{ safeSql: string, chartType: string }> {
    const aiResponse = await this.aiService.generateSql(question, schemaContext);
    
    let aiResultObj;
    try {
      const cleanJsonString = typeof aiResponse === 'string' 
        ? aiResponse.replace(/```json/g, '').replace(/```/g, '').trim() 
        : aiResponse;
        
      aiResultObj = typeof cleanJsonString === 'string' ? JSON.parse(cleanJsonString) : cleanJsonString;
    } catch (e) {
      throw new Error('AI Text-to-SQL không trả về đúng định dạng JSON.');
    }

    const rawSql = aiResultObj.sql_query;
    this.logger.log(`AI sinh ra SQL: ${rawSql}`);

    const safeSql = this.guardrailsService.validateAndSanitize(rawSql);
    this.logger.log(`SQL an toàn sau Guardrails: ${safeSql}`);

    return { 
      safeSql, 
      chartType: aiResultObj.chart_type 
    };
  }

  private async step3_queryDatabase(safeSql: string, signal?: AbortSignal): Promise<any[]> {
    const dbData = await this.dbService.executeBizQuery(safeSql);
    this.logger.log(`Đã lấy được ${dbData?.length || 0} dòng dữ liệu.`);
    return dbData || [];
  }

  private async step4_generateInsightsAsync(
    question: string, 
    dbData: any[], 
    signal?: AbortSignal
  ): Promise<string> {
    if (!dbData || dbData.length === 0) return "";

    this.logger.log(`Đang phân tích số liệu thực tế (Soft Timeout: 5s)...`);
    
    const INSIGHT_TIMEOUT_MS = 5000; // Giới hạn 5 giây cho việc phân tích
    let timeoutHandle: NodeJS.Timeout;

    const insightPromise = this.aiService.generateDataInsights(question, dbData);
    
    const timeoutPromise = new Promise<string>((resolve) => {
      timeoutHandle = setTimeout(() => {
        this.logger.warn(`Bỏ qua bước tạo Insight do LLM phản hồi chậm (vượt quá ${INSIGHT_TIMEOUT_MS}ms). Ưu tiên trả về Data cho UI.`);
        resolve(""); // Trả về rỗng để UI hiển thị Data/Biểu đồ ngay lập tức
      }, INSIGHT_TIMEOUT_MS);
    });

    try {
      return await Promise.race([insightPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle!); // Dọn dẹp bộ nhớ ngay khi nhận được kết quả
    }
  }

  private handlePipelineError(error: any) {
    this.logger.error(`Lỗi hệ thống: ${error.message}`, error.stack);
      
    const errorMsg = error.message?.toLowerCase() || '';

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
    
    if (errorMsg.includes('all_models_overloaded')) {
      return { 
        error: "Hệ thống AI hiện đang quá tải. Đã thử tự động chuyển đổi qua lại giữa các phiên bản nhưng không thành công. Vui lòng thử lại sau vài phút.", 
        error_type: "LIMIT_REACHED" 
      };
    }

    return { 
      error: error.message || "Lỗi hệ thống không xác định.", 
      error_type: "UNKNOWN" 
    };
  }
}