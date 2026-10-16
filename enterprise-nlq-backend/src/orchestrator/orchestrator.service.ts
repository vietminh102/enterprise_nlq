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
  async getChatHistory(sessionId: string) {
    try {
      const sql = `SELECT chat_history FROM audit_logs WHERE log_id = $1 LIMIT 1;`;
      const result = await this.dbService.executeCoreQuery(sql, [sessionId]);
      
      if (result && result.length > 0 && result[0].chat_history) {
        return { success: true, history: result[0].chat_history };
      }
      return { success: false, history: [] };
    } catch (error: any) {
      console.error('[Orchestrator] Lỗi khi lấy lịch sử:', error.message);
      return { success: false, error: 'Không thể lấy lịch sử' };
    }
  }
  
  async getAllChatSessions() {
    try {
    const sql = `
        SELECT log_id as session_id, natural_query as title 
        FROM audit_logs 
        WHERE log_id IS NOT NULL AND log_id::text NOT LIKE 'cron-%' 
        ORDER BY log_id DESC 
        LIMIT 50;
      `;
      const result = await this.dbService.executeCoreQuery(sql);
      return { success: true, sessions: result || [] };
    } catch (error: any) {
      console.error('[Orchestrator] Lỗi khi lấy danh sách phiên:', error.message);
      return { success: false, error: 'Không thể lấy danh sách' };
    }
  }

  async processNaturalLanguageQuery(sessionId: string,question: string, history?: any[]) {
    const startTime = Date.now();
    let generatedSqlForLog = ''; 

    try {
      console.log(`[Orchestrator] Nhận câu hỏi: "${question}"`);


      // Bước 1: RAG - Tìm Schema liên quan
      const schemas = await this.vectorSearchService.findRelevantSchemas(question);
      console.log(`[Orchestrator] Dữ liệu thô từ Vector Search:`, schemas);

      if (!schemas || schemas.length === 0) {
        console.warn(`[Orchestrator] ⚠️ CẢNH BÁO: Không tìm thấy Schema nào trong Vector DB.`);
      }

      const schemaContext = schemas.map((item: any) => {
        if (typeof item === 'string') return item;
        return item.description || item.schema_info || item.content || JSON.stringify(item); 
      }).join('\n');

      console.log(`[Orchestrator] Đã tổng hợp Schema dài ${schemaContext.length} ký tự.`);

      let glossaryContext = "";
      try {
        const glossaryQuery = `SELECT term_name, definition, sql_logic FROM business_glossary`;
        const glossaryData = await this.dbService.executeCoreQuery(glossaryQuery);
        
        if (glossaryData && glossaryData.length > 0) {
          glossaryContext = glossaryData.map((item: any) => 
            `- Khi người dùng nhắc đến "${item.term_name}": Định nghĩa là "${item.definition}". Hãy áp dụng điều kiện SQL: [${item.sql_logic}]`
          ).join('\n');
          console.log(`[Orchestrator] Đã nạp ${glossaryData.length} thuật ngữ nghiệp vụ.`);
        }
      } catch (err: any) {
        console.warn(`[Orchestrator] Lỗi khi lấy Glossary (Sẽ tiếp tục mà không có Glossary):`, err.message);
      }


      // Bước 2: AI Text-to-SQL
      const aiResponse = await this.aiService.generateSql(question, schemaContext,glossaryContext,history);
      
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
      generatedSqlForLog = safeSql; 
      console.log(`[Orchestrator] SQL an toàn: ${safeSql}`);

      // Bước 4: Database (Chạy trên BIZ DB)
      const dbData = await this.dbService.executeBizQuery(safeSql);
      console.log(`[Orchestrator] Đã lấy được ${dbData.length} dòng dữ liệu.`);

      let insights = "";
      if (dbData && dbData.length > 0) {
        console.log(`[Orchestrator] Đang nhờ AI phân tích số liệu thực tế...`);
        insights = await this.aiService.generateDataInsights(question, dbData);
      }

      // ==========================================
      // BƯỚC 5: LƯU AUDIT LOG KÈM THEO CHART VÀ EXPLANATION
      // ==========================================
const executionTime = Date.now() - startTime;
      try {
        const fullChatHistory = [
          ...(history || []),
          { role: 'user', content: question },
          { 
            role: 'assistant', 
            content: insights || 'Đã truy xuất xong',
            chart_type: aiResultObj.chart_type,
            generated_sql: safeSql
          }
        ];

        // Lệnh UPSERT ĐÃ ĐƯỢC LÀM SẠCH (Chỉ còn 5 cột)
        const upsertLogSql = `
          INSERT INTO audit_logs (log_id, natural_query, execution_time, status, chat_history) 
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (log_id) DO UPDATE SET 
            chat_history = EXCLUDED.chat_history,
            execution_time = audit_logs.execution_time + EXCLUDED.execution_time,
            status = EXCLUDED.status;
        `;
        
        await this.dbService.executeCoreQuery(upsertLogSql, [
          sessionId, 
          question, 
          executionTime, 
          'SUCCESS',
          JSON.stringify(fullChatHistory)
        ]);
        console.log(`[Audit] Đã lưu log thành công.`);
      } catch (logError: any) {
        console.error('[Audit] Cảnh báo: Lỗi khi lưu audit_log:', logError.message);
      }

      return {
        success: true,
        question: question,
        generated_sql: safeSql,
        chart_type: aiResultObj.chart_type,
        explanation: insights,
        data: dbData,
        is_cached: false
      };

    } catch (error: any) {
      const errorMsg = error.message?.toLowerCase() || '';
      const executionTime = Date.now() - startTime;
      let status = 'DB_ERROR'; 
      
      if (errorMsg.includes('safety_violation') || errorMsg.includes('vi phạm bảo mật')) {
        status = 'BLOCKED_BY_AST'; 
      }

      // LƯU LỖI VÀO CHAT HISTORY (ĐÃ XÓA generated_sql KHỎI LỆNH)
      try {
        const fullChatHistoryError = [
          ...(history || []),
          { role: 'user', content: question },
          { role: 'assistant', content: error.message, is_error: true, status: status }
        ];

        const upsertErrorLogSql = `
          INSERT INTO audit_logs (log_id, natural_query, execution_time, status, chat_history) 
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (log_id) DO UPDATE SET 
            chat_history = EXCLUDED.chat_history,
            status = EXCLUDED.status;
        `;
        
        await this.dbService.executeCoreQuery(upsertErrorLogSql, [
          sessionId,
          question,
          executionTime,
          status,
          JSON.stringify(fullChatHistoryError)
        ]);
      } catch (logError: any) {}

      if (status === 'BLOCKED_BY_AST') return { error: "Yêu cầu bị chặn do bảo vệ dữ liệu.", error_type: "SAFETY_VIOLATION" };
      if (errorMsg.includes('all_models_overloaded')) return { error: "Hệ thống AI quá tải.", error_type: "LIMIT_REACHED" };
      return { error: error.message || "Lỗi hệ thống.", error_type: "UNKNOWN" };
    }
  }
}